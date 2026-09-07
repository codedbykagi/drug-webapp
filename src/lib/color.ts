/**
 * Colour maths for reagent colorimetry.
 *
 * Everything that touches white balance happens in LINEAR light, not in gamma-
 * encoded sRGB. Scaling gamma-encoded channels is the usual shortcut and it
 * skews hue as soon as the correction is more than a few percent, which is
 * exactly the regime we care about (tungsten vs daylight is a ~40% red/blue
 * swing).
 */

export type RGB = [number, number, number]; // 0..255, gamma-encoded sRGB
export type LinearRGB = [number, number, number]; // 0..1, linear light
export interface Lab {
  L: number;
  a: number;
  b: number;
}

const D65 = { X: 0.95047, Y: 1.0, Z: 1.08883 };

export function srgbToLinear(channel8: number): number {
  const c = channel8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

export function toLinear(rgb: RGB): LinearRGB {
  return [srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2])];
}

export function toSrgb(lin: LinearRGB): RGB {
  return [linearToSrgb(lin[0]), linearToSrgb(lin[1]), linearToSrgb(lin[2])];
}

export function linearToXyz([r, g, b]: LinearRGB): [number, number, number] {
  return [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ];
}

export function xyzToLab([X, Y, Z]: [number, number, number]): Lab {
  const eps = 216 / 24389;
  const kappa = 24389 / 27;
  const f = (t: number) => (t > eps ? Math.cbrt(t) : (kappa * t + 16) / 116);
  const fx = f(X / D65.X);
  const fy = f(Y / D65.Y);
  const fz = f(Z / D65.Z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function rgbToLab(rgb: RGB): Lab {
  return xyzToLab(linearToXyz(toLinear(rgb)));
}

export function labToRgb(lab: Lab): RGB {
  const eps = 216 / 24389;
  const kappa = 24389 / 27;
  const fy = (lab.L + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;
  const finv = (t: number) => (t ** 3 > eps ? t ** 3 : (116 * t - 16) / kappa);
  const X = finv(fx) * D65.X;
  const Y = (lab.L > kappa * eps ? ((lab.L + 16) / 116) ** 3 : lab.L / kappa) * D65.Y;
  const Z = finv(fz) * D65.Z;
  const r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  const g = -0.969266 * X + 1.8760108 * Y + 0.041556 * Z;
  const b = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
  return toSrgb([r, g, b]);
}

const deg = (rad: number) => (rad * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * CIEDE2000. Plain Euclidean distance in Lab under-weights lightness
 * differences at the dark end, which is where most reagent reactions land
 * (Marquis going to near-black, Scott going to deep cobalt). Worth the extra
 * fifty lines.
 *
 * Rule of thumb on the output: <1 is invisible to the eye, ~2-3 is a "just
 * noticeable" difference, >10 is plainly a different colour.
 */
export function deltaE2000(l1: Lab, l2: Lab): number {
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const C1 = Math.hypot(l1.a, l1.b);
  const C2 = Math.hypot(l2.a, l2.b);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Cbar ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));

  const a1p = (1 + G) * l1.a;
  const a2p = (1 + G) * l2.a;
  const C1p = Math.hypot(a1p, l1.b);
  const C2p = Math.hypot(a2p, l2.b);

  const hp = (b: number, ap: number) => {
    if (ap === 0 && b === 0) return 0;
    const h = deg(Math.atan2(b, ap));
    return h < 0 ? h + 360 : h;
  };
  const h1p = hp(l1.b, a1p);
  const h2p = hp(l2.b, a2p);

  const dLp = l2.L - l1.L;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);

  const Lbarp = (l1.L + l2.L) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp: number;
  if (C1p * C2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
  else hbarp = (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos(rad(hbarp - 30)) +
    0.24 * Math.cos(rad(2 * hbarp)) +
    0.32 * Math.cos(rad(3 * hbarp + 6)) -
    0.2 * Math.cos(rad(4 * hbarp - 63));

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;

  const termL = dLp / (kL * Sl);
  const termC = dCp / (kC * Sc);
  const termH = dHp / (kH * Sh);

  return Math.sqrt(termL ** 2 + termC ** 2 + termH ** 2 + Rt * termC * termH);
}

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Median rather than mean. A reagent pouch is glossy, so the sample window
 * almost always catches a specular highlight or two; a mean drags the reading
 * toward white, a median ignores it.
 */
export function samplePatch(
  data: ImageData,
  cx: number,
  cy: number,
  radius: number
): { rgb: RGB; pixels: number; spread: number } {
  const x0 = Math.max(0, Math.round(cx - radius));
  const x1 = Math.min(data.width - 1, Math.round(cx + radius));
  const y0 = Math.max(0, Math.round(cy - radius));
  const y1 = Math.min(data.height - 1, Math.round(cy + radius));

  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * data.width + x) * 4;
      if (data.data[i + 3] < 128) continue;
      rs.push(data.data[i]);
      gs.push(data.data[i + 1]);
      bs.push(data.data[i + 2]);
    }
  }

  if (!rs.length) return { rgb: [0, 0, 0], pixels: 0, spread: 0 };

  const median = (arr: number[]) => {
    arr.sort((a, b) => a - b);
    const mid = arr.length >> 1;
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  const rgb: RGB = [median(rs), median(gs), median(bs)];

  // Interquartile range on luma, as a crude "is this patch uniform" score.
  // A high spread means the window straddles an edge and the reading is junk.
  const lumas = rs.map((_, i) => 0.2126 * rs[i] + 0.7152 * gs[i] + 0.0722 * bs[i]).sort((a, b) => a - b);
  const q = (p: number) => lumas[Math.min(lumas.length - 1, Math.floor(lumas.length * p))];
  const spread = q(0.75) - q(0.25);

  return { rgb, pixels: rs.length, spread };
}

/**
 * Von Kries diagonal adaptation. `neutral` is what the camera actually recorded
 * for a surface we know to be grey; the gains are what it takes to make that
 * surface come out grey again.
 *
 * Normalised on green so the correction changes colour but not exposure.
 */
export function gainsFromNeutral(neutral: RGB): LinearRGB {
  const [r, g, b] = toLinear(neutral);
  const floor = 1e-4;
  return [g / Math.max(r, floor), 1, g / Math.max(b, floor)];
}

export function applyGains(rgb: RGB, gains: LinearRGB, exposure = 1): RGB {
  const lin = toLinear(rgb);
  return toSrgb([
    lin[0] * gains[0] * exposure,
    lin[1] * gains[1] * exposure,
    lin[2] * gains[2] * exposure,
  ]);
}

export function applyGainsToImage(data: ImageData, gains: LinearRGB, exposure = 1): ImageData {
  // 256-entry LUT per channel. Doing the pow() twice per subpixel on a 12MP
  // phone photo is about 70 million calls and locks up the main thread.
  const lut = [0, 1, 2].map((c) => {
    const table = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      table[v] = linearToSrgb(srgbToLinear(v) * gains[c] * exposure);
    }
    return table;
  });

  const out = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = lut[0][data.data[i]];
    out.data[i + 1] = lut[1][data.data[i + 1]];
    out.data[i + 2] = lut[2][data.data[i + 2]];
  }
  return out;
}

/**
 * McCamy's cubic approximation of correlated colour temperature. Only valid
 * near the Planckian locus, so it is a readout for the officer ("this looks
 * like tungsten"), not something the matching depends on.
 */
export function estimateCct(neutral: RGB): number | null {
  const [X, Y, Z] = linearToXyz(toLinear(neutral));
  const sum = X + Y + Z;
  if (sum <= 0) return null;
  const x = X / sum;
  const y = Y / sum;
  if (Math.abs(0.1858 - y) < 1e-6) return null;
  const n = (x - 0.332) / (0.1858 - y);
  const cct = 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33;
  return cct > 1000 && cct < 25000 ? Math.round(cct) : null;
}

/** Relative luminance 0..1 of a patch, for the over/under-exposure warning. */
export function relativeLuminance(rgb: RGB): number {
  const [r, g, b] = toLinear(rgb);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function describeHue(lab: Lab): string {
  const chroma = Math.hypot(lab.a, lab.b);
  const light = lab.L;
  if (chroma < 6) {
    if (light < 18) return 'Near-black';
    if (light < 40) return 'Dark neutral';
    if (light < 70) return 'Grey';
    return 'Off-white';
  }
  let hue = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  const names: [number, string][] = [
    [15, 'Red'],
    [45, 'Orange'],
    [70, 'Amber'],
    [100, 'Yellow'],
    [160, 'Green'],
    [200, 'Teal'],
    [250, 'Blue'],
    [290, 'Violet'],
    [330, 'Magenta'],
    [360, 'Red'],
  ];
  const name = names.find(([limit]) => hue < limit)?.[1] ?? 'Red';
  const prefix = light < 25 ? 'Deep ' : light > 72 ? 'Pale ' : '';
  return prefix + name.toLowerCase();
}
