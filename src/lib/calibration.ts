/**
 * The "light tool".
 *
 * Nothing here tries to guess what the lighting was. It measures it, using a
 * surface of known reflectance that has to be physically present in the shot.
 * Print public/reference-card.html, or use any neutral grey card, or a
 * sheet of plain office paper at a pinch.
 *
 * Two levels:
 *   1. One neutral patch -> von Kries diagonal gains. Fixes colour cast.
 *      Good enough for the vast majority of field conditions.
 *   2. Four or more known patches -> least-squares 3x3 matrix. Also fixes the
 *      camera's own channel crosstalk, which is what makes two different phone
 *      models disagree on the same pouch under the same light.
 *
 * Level 1 is the default because it needs nothing but a grey square.
 */

import {
  LinearRGB,
  RGB,
  applyGains,
  estimateCct,
  gainsFromNeutral,
  relativeLuminance,
  samplePatch,
  toLinear,
  toSrgb,
} from './color';

export interface CalibrationProfile {
  gains: LinearRGB;
  matrix: number[] | null; // row-major 3x3, linear light, null when level 1
  neutralRaw: RGB;
  cct: number | null;
  luminance: number; // 0..1, of the reference patch
  quality: CalibrationQuality;
  method: 'neutral-patch' | 'colour-target' | 'manual';
  capturedAt: string;
}

export interface CalibrationQuality {
  score: number; // 0..100
  usable: boolean;
  warnings: string[];
}

const CLIP_HIGH = 0.92;
const CLIP_LOW = 0.02;

/**
 * A white card is a bad reference in bright light because it clips, and a grey
 * card is a bad reference indoors because it goes noisy. We accept either and
 * just say which end we are near.
 */
export function assessNeutral(raw: RGB, spread: number): CalibrationQuality {
  const warnings: string[] = [];
  const lum = relativeLuminance(raw);
  const maxChannel = Math.max(...raw) / 255;
  const minChannel = Math.min(...raw) / 255;
  const cast = (Math.max(...raw) - Math.min(...raw)) / 255;

  // Score and usability answer different questions. A clipped or crushed patch
  // carries no recoverable information however clean it otherwise looks, so
  // those are hard stops rather than deductions: a run of small penalties must
  // never add up to "acceptable" for a reference that is physically unreadable.
  let disqualified = false;
  let score = 100;

  const fail = (message: string) => {
    warnings.push(message);
    disqualified = true;
  };
  const penalise = (message: string, cost: number) => {
    warnings.push(message);
    score -= cost;
  };

  if (maxChannel >= 0.99) {
    fail('Reference patch is clipped. Move out of direct sun, or lower the exposure.');
  } else if (lum > CLIP_HIGH) {
    penalise('Reference patch is close to clipping.', 25);
  }

  if (lum < CLIP_LOW) {
    fail('Reference patch is too dark to measure. Add light.');
  } else if (lum < 0.06) {
    penalise('Low light on the reference patch; readings will be noisy.', 25);
  }

  if (minChannel <= 0.004) {
    fail('A colour channel has crushed to zero, so no correction can be computed.');
  }

  // A large cast is fine, that is the whole point, but an extreme one usually
  // means the box is sitting on something coloured rather than on the card.
  if (cast > 0.45) {
    fail('Reference reads strongly coloured. Check the box is on the grey patch.');
  } else if (cast > 0.3) {
    penalise('Strong colour cast. Confirm the box is on the reference card.', 15);
  }

  if (spread > 40) {
    penalise('Patch area is not uniform. Move the box fully inside the card.', 35);
  } else if (spread > 22) {
    penalise('Patch area has visible shading or a shadow edge.', 15);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: disqualified ? Math.min(score, 30) : score,
    usable: !disqualified && score >= 50,
    warnings,
  };
}

export function profileFromNeutral(raw: RGB, spread: number): CalibrationProfile {
  return {
    gains: gainsFromNeutral(raw),
    matrix: null,
    neutralRaw: raw,
    cct: estimateCct(raw),
    luminance: relativeLuminance(raw),
    quality: assessNeutral(raw, spread),
    method: 'neutral-patch',
    capturedAt: new Date().toISOString(),
  };
}

export function sampleNeutralFromImage(
  data: ImageData,
  cx: number,
  cy: number,
  radius: number
): CalibrationProfile {
  const { rgb, spread } = samplePatch(data, cx, cy, radius);
  return profileFromNeutral(rgb, spread);
}

export function correctSample(rgb: RGB, profile: CalibrationProfile | null): RGB {
  if (!profile) return rgb;
  if (profile.matrix) return applyMatrix(rgb, profile.matrix);
  return applyGains(rgb, profile.gains);
}

export function applyMatrix(rgb: RGB, m: number[]): RGB {
  const [r, g, b] = toLinear(rgb);
  return toSrgb([
    m[0] * r + m[1] * g + m[2] * b,
    m[3] * r + m[4] * g + m[5] * b,
    m[6] * r + m[7] * g + m[8] * b,
  ]);
}

/**
 * Least-squares 3x3 fit, M such that M * measured ~= reference, in linear light.
 * Solves the normal equations one output channel at a time.
 *
 * Needs at least 4 patches to be worth anything and they must not all be
 * neutral, or the system is degenerate and you may as well use the diagonal.
 */
export function fitColourMatrix(measured: RGB[], reference: RGB[]): number[] | null {
  if (measured.length !== reference.length || measured.length < 4) return null;

  const A = measured.map(toLinear);
  const B = reference.map(toLinear);

  // AtA is 3x3 and shared across all three solves.
  const AtA = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const row of A) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        AtA[i * 3 + j] += row[i] * row[j];
      }
    }
  }

  const inv = invert3x3(AtA);
  if (!inv) return null;

  const m: number[] = [];
  for (let out = 0; out < 3; out++) {
    const Atb = [0, 0, 0];
    for (let k = 0; k < A.length; k++) {
      for (let i = 0; i < 3; i++) Atb[i] += A[k][i] * B[k][out];
    }
    for (let i = 0; i < 3; i++) {
      m.push(inv[i * 3] * Atb[0] + inv[i * 3 + 1] * Atb[1] + inv[i * 3 + 2] * Atb[2]);
    }
  }
  return m;
}

function invert3x3(m: number[]): number[] | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!isFinite(det) || Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;
  return [
    A * invDet,
    -(b * i - c * h) * invDet,
    (b * f - c * e) * invDet,
    B * invDet,
    (a * i - c * g) * invDet,
    -(a * f - c * d) * invDet,
    C * invDet,
    -(a * h - b * g) * invDet,
    (a * e - b * d) * invDet,
  ];
}

export function describeIlluminant(cct: number | null): string {
  if (!cct) return 'Unclassified';
  if (cct < 2900) return 'Tungsten / warm bulb';
  if (cct < 3800) return 'Warm white LED';
  if (cct < 4600) return 'Neutral white LED';
  if (cct < 5600) return 'Daylight';
  if (cct < 7000) return 'Overcast daylight';
  return 'Shade / blue cast';
}

/*
 * There is deliberately no automatic reference-card detector here, and there
 * should not be one.
 *
 * A grey card photographed under tungsten light and an orange desk photographed
 * under daylight produce the same pixels — (225, 180, 126) in both cases. No
 * algorithm can separate them from the image alone, because the difference is
 * not in the image. That ambiguity is the colour constancy problem, and it is
 * the whole reason this project uses a physical reference instead of estimating
 * the illuminant.
 *
 * A detector would therefore be a guess wearing the costume of a measurement,
 * and it would fail in the direction that matters: quietly reporting a
 * corrected reading that was never corrected. The app asks the officer to mark
 * the card, and says plainly when they have not.
 */
