import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * getUserMedia wrapper aimed at phones.
 *
 * The two things that actually matter for colorimetry, and that a naive
 * implementation misses:
 *
 *   Exposure and white balance lock. If auto-WB is running, the phone will
 *   re-balance between the "before" and "after" shot and invent a colour
 *   difference that was never in the pouch. Where the browser exposes the
 *   constraint we pin both. Where it does not (Safari, most of the time) the
 *   in-frame reference patch is what saves us, which is why that is not
 *   optional.
 *
 *   Torch. A constant, known light source beats whatever the room is doing.
 */

export interface CameraCapabilities {
  torch: boolean;
  exposureLock: boolean;
  whiteBalanceLock: boolean;
  lensCount: number;
}

export interface CameraState {
  active: boolean;
  starting: boolean;
  error: string | null;
  torchOn: boolean;
  locked: boolean;
  capabilities: CameraCapabilities;
}

const NO_CAPS: CameraCapabilities = {
  torch: false,
  exposureLock: false,
  whiteBalanceLock: false,
  lensCount: 0,
};

type ExtendedConstraints = MediaTrackConstraintSet & {
  torch?: boolean;
  exposureMode?: string;
  whiteBalanceMode?: string;
  focusMode?: string;
};

export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>({
    active: false,
    starting: false,
    error: null,
    torchOn: false,
    locked: false,
    capabilities: NO_CAPS,
  });
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState((s) => ({ ...s, active: false, starting: false, torchOn: false, locked: false }));
  }, [videoRef]);

  const start = useCallback(
    async (mode: 'environment' | 'user' = facing) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState((s) => ({ ...s, error: 'This browser does not expose a camera API.' }));
        return false;
      }
      if (!window.isSecureContext) {
        setState((s) => ({
          ...s,
          error: 'Camera needs HTTPS. Open the site over https, or on localhost.',
        }));
        return false;
      }

      stop();
      setState((s) => ({ ...s, starting: true, error: null }));

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 2560 },
            height: { ideal: 1440 },
          },
          audio: false,
        });

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          setState((s) => ({ ...s, starting: false }));
          return false;
        }

        video.srcObject = stream;
        await video.play();

        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
          torch?: boolean;
          exposureMode?: string[];
          whiteBalanceMode?: string[];
        };

        // Only counted after permission is granted; before that the labels and
        // deviceIds are blank and the count is unreliable.
        const devices = await navigator.mediaDevices.enumerateDevices();

        setFacing(mode);
        setState({
          active: true,
          starting: false,
          error: null,
          torchOn: false,
          locked: false,
          capabilities: {
            torch: Boolean(caps.torch),
            exposureLock: (caps.exposureMode ?? []).includes('manual'),
            whiteBalanceLock: (caps.whiteBalanceMode ?? []).includes('manual'),
            lensCount: devices.filter((d) => d.kind === 'videoinput').length,
          },
        });
        return true;
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        const message =
          name === 'NotAllowedError'
            ? 'Camera permission was declined. Allow it in the browser address bar, or upload a photo instead.'
            : name === 'NotFoundError'
              ? 'No camera found on this device.'
              : name === 'NotReadableError'
                ? 'The camera is already in use by another app.'
                : 'Could not start the camera. Upload a photo instead.';
        setState((s) => ({ ...s, starting: false, active: false, error: message }));
        return false;
      }
    },
    [facing, stop, videoRef]
  );

  const flip = useCallback(() => start(facing === 'environment' ? 'user' : 'environment'), [facing, start]);

  const setTorch = useCallback(async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as ExtendedConstraints] });
      setState((s) => ({ ...s, torchOn: on }));
    } catch {
      setState((s) => ({ ...s, capabilities: { ...s.capabilities, torch: false } }));
    }
  }, []);

  /**
   * Called right before the first capture. Whatever the sensor has settled on
   * is what both shots get.
   */
  const lockExposure = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return false;
    const advanced: ExtendedConstraints[] = [];
    if (state.capabilities.exposureLock) advanced.push({ exposureMode: 'manual' });
    if (state.capabilities.whiteBalanceLock) advanced.push({ whiteBalanceMode: 'manual' });
    if (!advanced.length) return false;
    try {
      await track.applyConstraints({ advanced });
      setState((s) => ({ ...s, locked: true }));
      return true;
    } catch {
      return false;
    }
  }, [state.capabilities.exposureLock, state.capabilities.whiteBalanceLock]);

  const unlockExposure = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ exposureMode: 'continuous', whiteBalanceMode: 'continuous' } as ExtendedConstraints],
      });
      setState((s) => ({ ...s, locked: false }));
    } catch {
      /* nothing to unlock */
    }
  }, []);

  useEffect(() => stop, [stop]);

  // Phones aggressively suspend camera tracks when the tab is backgrounded and
  // hand back a frozen frame on return. Dropping the stream is honest.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && streamRef.current) stop();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [stop]);

  return { ...state, facing, start, stop, flip, setTorch, lockExposure, unlockExposure };
}
