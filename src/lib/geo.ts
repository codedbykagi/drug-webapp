import type { GeoFix } from '../types';

export class GeoError extends Error {
  constructor(message: string, readonly recoverable: boolean) {
    super(message);
    this.name = 'GeoError';
  }
}

/**
 * One shot, high accuracy, generous timeout. GPS indoors or under a flyover can
 * take 20s to get a first fix and the officer would rather wait than file a
 * case with a cell-tower estimate on it.
 */
export function getFix(timeoutMs = 20000): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeoError('This browser has no location support.', false));
      return;
    }
    if (!window.isSecureContext) {
      reject(new GeoError('Location needs HTTPS. Open the site over https or on localhost.', false));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: Math.round(pos.coords.accuracy),
          altitudeM: pos.coords.altitude === null ? null : Math.round(pos.coords.altitude),
          capturedAt: new Date(pos.timestamp).toISOString(),
        }),
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new GeoError('Location permission was declined.', true));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new GeoError('No position fix available. Try moving into the open.', true));
            break;
          default:
            reject(new GeoError('Location request timed out.', true));
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

export function formatFix(fix: GeoFix | null): string {
  if (!fix) return 'Not recorded';
  const lat = `${Math.abs(fix.latitude).toFixed(5)}° ${fix.latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(fix.longitude).toFixed(5)}° ${fix.longitude >= 0 ? 'E' : 'W'}`;
  const alt = fix.altitudeM === null ? '' : `, ${fix.altitudeM}m`;
  return `${lat}, ${lon} (±${fix.accuracyM}m${alt})`;
}

export function mapsUrl(fix: GeoFix): string {
  return `https://www.google.com/maps/search/?api=1&query=${fix.latitude},${fix.longitude}`;
}
