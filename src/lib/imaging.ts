/**
 * Bitmap plumbing. Kept apart from the colour maths so that module stays
 * testable without a DOM.
 */

const MAX_STORED_EDGE = 1600;

export interface Bitmap {
  data: ImageData;
  width: number;
  height: number;
}

/**
 * createImageBitmap with imageOrientation:'from-image' applies the EXIF
 * rotation for us. Without it, photos from most Android cameras arrive
 * sideways and every sample coordinate the officer tapped is wrong.
 */
export async function decode(source: Blob): Promise<Bitmap> {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.drawImage(bitmap, 0, 0);
    return {
      data: ctx.getImageData(0, 0, bitmap.width, bitmap.height),
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

/**
 * Full-resolution phone photos are 10-12MB each and we store two per case.
 * 1600px on the long edge keeps far more detail than any colour reading needs
 * while landing around 300KB.
 */
export async function normalise(source: Blob, maxEdge = MAX_STORED_EDGE): Promise<Blob> {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    // 0.92 rather than the usual 0.8. JPEG chroma subsampling is the enemy here
    // and cranking quality keeps the reaction colour honest.
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  } finally {
    bitmap.close();
  }
}

export function frameToBlob(
  video: HTMLVideoElement,
  maxEdge = MAX_STORED_EDGE
): Promise<Blob> {
  const sw = video.videoWidth;
  const sh = video.videoHeight;
  if (!sw || !sh) return Promise.reject(new Error('Camera has not produced a frame yet'));

  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('2D canvas context unavailable'));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Frame encoding failed'))),
      'image/jpeg',
      0.92
    );
  });
}

export async function bitmapToBlob(data: ImageData): Promise<Blob> {
  const canvas = new OffscreenCanvas(data.width, data.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.putImageData(data, 0, 0);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
}

/**
 * Sample radius scaled to the image. A fixed pixel radius reads a tiny speck on
 * a 4000px photo and half the frame on a 300px one.
 */
export function sampleRadius(width: number, height: number, fraction = 0.022): number {
  return Math.max(3, Math.round(Math.min(width, height) * fraction));
}
