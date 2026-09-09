import type { CalibrationProfile } from './calibration';
import { correctSample, profileFromNeutral } from './calibration';
import { rgbToHex, rgbToLab, samplePatch } from './color';
import { decode, normalise, sampleRadius } from './imaging';
import type { CaptureStage, Measurement, SamplePoint, Shot } from '../types';

export interface WorkingShot extends Shot {
  previewUrl: string;
}


/**
 * Decoding a 1600px JPEG costs about 40ms, and the officer will drag the sample
 * point around a dozen times before they are happy with it. Cache per blob.
 * WeakMap so the pixels go when the shot does.
 */
const pixelCache = new WeakMap<Blob, ImageData>();

async function pixels(blob: Blob): Promise<ImageData> {
  const cached = pixelCache.get(blob);
  if (cached) return cached;
  const { data } = await decode(blob);
  pixelCache.set(blob, data);
  return data;
}

const DEFAULT_POINT: SamplePoint = { x: 0.5, y: 0.5 };

export async function createShot(
  raw: Blob,
  stage: CaptureStage,
  source: 'camera' | 'upload'
): Promise<WorkingShot> {
  const blob = await normalise(raw);
  const data = await pixels(blob);

  const shot: WorkingShot = {
    id: `shot-${crypto.randomUUID()}`,
    stage,
    blob,
    width: data.width,
    height: data.height,
    source,
    capturedAt: new Date().toISOString(),
    neutralPoint: null,
    calibration: null,
    measurement: null,
    previewUrl: URL.createObjectURL(blob),
  };

  return measure(shot, null, DEFAULT_POINT);
}

/**
 * Recomputes the reading. Order matters: the reference patch is sampled from
 * the *raw* frame and used to build the correction, then the reaction point is
 * sampled and corrected. Correcting the whole image first and then sampling
 * gives the same answer but wastes a full-frame pass.
 */
export async function measure(
  shot: WorkingShot,
  neutralPoint: SamplePoint | null,
  reactionPoint: SamplePoint
): Promise<WorkingShot> {
  const data = await pixels(shot.blob);
  const radius = sampleRadius(data.width, data.height);

  let calibration: CalibrationProfile | null = null;
  if (neutralPoint) {
    const { rgb, spread } = samplePatch(
      data,
      neutralPoint.x * data.width,
      neutralPoint.y * data.height,
      radius
    );
    calibration = profileFromNeutral(rgb, spread);
  }

  const { rgb, spread } = samplePatch(
    data,
    reactionPoint.x * data.width,
    reactionPoint.y * data.height,
    radius
  );

  const corrected = correctSample(rgb, calibration);
  const measurement: Measurement = {
    raw: rgb,
    corrected,
    hex: rgbToHex(corrected),
    lab: rgbToLab(corrected),
    point: reactionPoint,
    spread,
    correctedBy: calibration ? 'in-frame reference' : 'none',
  };

  return { ...shot, neutralPoint, calibration, measurement };
}

/**
 * Falls back to a calibration profile captured earlier from a grey card. Weaker
 * than an in-frame reference because it assumes the light has not changed since,
 * so it is only applied when the frame carries no reference of its own.
 */
export function applyStoredProfile(
  shot: WorkingShot | null,
  profile: CalibrationProfile | null
): WorkingShot | null {
  // An empty slot, an already-corrected frame and a missing profile all mean
  // "leave it alone", so they collapse into one guard.
  if (!shot || !shot.measurement || shot.calibration || !profile) return shot;
  const corrected = correctSample(shot.measurement.raw, profile);
  return {
    ...shot,
    measurement: {
      ...shot.measurement,
      corrected,
      hex: rgbToHex(corrected),
      lab: rgbToLab(corrected),
      correctedBy: 'stored profile',
    },
  };
}

export function releaseShot(shot: WorkingShot | null): void {
  if (shot) URL.revokeObjectURL(shot.previewUrl);
}

export function attachPreview(shot: Shot): WorkingShot {
  return { ...shot, previewUrl: URL.createObjectURL(shot.blob) };
}

export function stripPreview(shot: WorkingShot): Shot {
  const { previewUrl, ...rest } = shot;
  return rest;
}
