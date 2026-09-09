import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera, Check, Lightbulb, RotateCcw, Sliders, Upload, X } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import {
  CalibrationProfile,
  describeIlluminant,
  profileFromNeutral,
} from '../../lib/calibration';
import { applyGains, rgbToHex, samplePatch } from '../../lib/color';
import { decode, sampleRadius } from '../../lib/imaging';
import type { CalibrationData } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  calibration: CalibrationData;
  onSaveCalibration: (updated: CalibrationData) => void;
  onTriggerToast: (title: string, msg: string, icon?: string) => void;
}

/** Fraction of the shorter edge that the on-screen target box covers. */
const TARGET_FRACTION = 0.18;

export const CalibrationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  calibration,
  onSaveCalibration,
  onTriggerToast,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camera = useCamera(videoRef);

  const [profile, setProfile] = useState<CalibrationProfile | null>(calibration.profile);
  const [tolerance, setTolerance] = useState(calibration.deltaETolerance);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setProfile(calibration.profile);
      setTolerance(calibration.deltaETolerance);
      setError(null);
    } else {
      camera.stop();
    }
    // camera.stop is stable; re-running on every render would kill the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const preview = useMemo(() => {
    if (!profile) return null;
    return {
      raw: rgbToHex(profile.neutralRaw),
      corrected: rgbToHex(applyGains(profile.neutralRaw, profile.gains)),
    };
  }, [profile]);

  if (!isOpen) return null;

  /**
   * Reads the centre box out of the current video frame. Deliberately samples
   * the live preview rather than taking a still, because the officer can watch
   * the numbers settle while they move the card around.
   */
  const sampleLive = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) {
      setError('The camera has not produced a frame yet.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const radius = Math.round(Math.min(canvas.width, canvas.height) * TARGET_FRACTION * 0.5);
    const { rgb, spread } = samplePatch(data, canvas.width / 2, canvas.height / 2, radius);

    const next = profileFromNeutral(rgb, spread);
    setProfile(next);
    setError(null);
    if (!next.quality.usable) {
      onTriggerToast('Reference rejected', next.quality.warnings[0] ?? 'Unusable reading', 'alert');
    }
  };

  const sampleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const { data } = await decode(file);
      const { rgb, spread } = samplePatch(
        data,
        data.width / 2,
        data.height / 2,
        sampleRadius(data.width, data.height, TARGET_FRACTION * 0.5)
      );
      setProfile(profileFromNeutral(rgb, spread));
      setError(null);
    } catch {
      setError('That file could not be read as an image.');
    }
  };

  const save = () => {
    if (!profile) return;
    onSaveCalibration({
      calibrated: true,
      scorePercent: profile.quality.score,
      colorTempK: profile.cct ?? 0,
      luxIlluminance: Math.round(profile.luminance * 1000),
      deltaETolerance: tolerance,
      lastCalibratedUtc: profile.capturedAt,
      macroLockAligned: profile.quality.usable,
      profile,
    });
    onTriggerToast(
      'Calibration saved',
      `${describeIlluminant(profile.cct)} · quality ${profile.quality.score}%`,
      'tune'
    );
    camera.stop();
    onClose();
  };

  const discard = () => {
    setProfile(null);
    onSaveCalibration({ ...calibration, calibrated: false, profile: null, scorePercent: 0 });
    onTriggerToast('Calibration cleared', 'Readings will fall back to in-frame references', 'tune');
  };


  return (
    <div
      id="modal-calibration"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div
        className="w-full max-w-xl glass-panel-elevated bg-black/95 rounded-lg border border-white/20 p-6 flex flex-col gap-5 shadow-2xl relative my-8"
        style={{
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.9), inset 0 1px 0 0 rgba(255, 255, 255, 0.25)',
        }}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded border border-white/30 bg-white/10 flex items-center justify-center">
              <Sliders className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white tracking-wide uppercase">
                Lighting reference
              </span>
              <span className="text-[10px] text-white/50">
                Fill the box with a grey card, white card or plain paper
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              camera.stop();
              onClose();
            }}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="w-full h-44 rounded border border-white/15 bg-white/5 flex items-center justify-center relative overflow-hidden grid-mesh">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${camera.active ? 'z-10' : 'invisible'}`}
          />

          {camera.active ? null : (
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <span className="text-[11px] text-white/50 leading-relaxed max-w-xs">
                The camera measures the light instead of guessing it. Anything you know to be
                neutral works — a grey card is best, office paper is fine.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void camera.start()}
                  disabled={camera.starting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white text-black font-semibold text-[11px] hover:bg-white/90 transition-all disabled:opacity-60"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{camera.starting ? 'Starting…' : 'Open camera'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/20 bg-white/5 hover:bg-white/15 text-white text-[11px] transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Use a photo</span>
                </button>
              </div>
            </div>
          )}

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="rounded-full border border-dashed border-white/60 reticle-ring"
              style={{ width: '18%', aspectRatio: '1', minWidth: 44 }}
            />
          </div>

          {camera.active && camera.capabilities.torch && (
            <button
              type="button"
              onClick={() => camera.setTorch(!camera.torchOn)}
              className={`absolute top-2 right-2 p-1.5 rounded border transition-colors ${
                camera.torchOn
                  ? 'bg-white text-black border-white'
                  : 'bg-black/70 text-white border-white/20'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="absolute bottom-2 left-3 text-[9px] text-white/60 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span>Centre box reads the reference</span>
          </div>
        </div>

        {(camera.error || error) && (
          <div className="text-xs text-white/70 bg-white/5 border border-white/15 p-3 rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-white/80 shrink-0" />
            <span>{camera.error ?? error}</span>
          </div>
        )}

        <div className="flex flex-col gap-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Illuminant">
              {profile ? (
                <span>
                  {profile.cct ? `${profile.cct}K` : 'Off-locus'}
                  <span className="text-white/40"> · {describeIlluminant(profile.cct)}</span>
                </span>
              ) : (
                <span className="text-white/40">Not measured</span>
              )}
            </Stat>

            <Stat label="Reference quality">
              {profile ? (
                <span className={profile.quality.usable ? '' : 'text-white/50'}>
                  {profile.quality.score}% {profile.quality.usable ? '' : '(reject)'}
                </span>
              ) : (
                <span className="text-white/40">—</span>
              )}
            </Stat>

            <Stat label="Correction applied">
              {preview ? (
                <span className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded border border-white/30"
                    style={{ background: preview.raw }}
                    title={`As captured: ${preview.raw}`}
                  />
                  <span className="text-white/40">→</span>
                  <span
                    className="w-3.5 h-3.5 rounded border border-white/30"
                    style={{ background: preview.corrected }}
                    title={`Corrected: ${preview.corrected}`}
                  />
                </span>
              ) : (
                <span className="text-white/40">—</span>
              )}
            </Stat>

            <Stat label="Channel gains">
              {profile ? (
                <span className="text-[11px]">
                  {profile.gains.map((g) => g.toFixed(2)).join(' · ')}
                </span>
              ) : (
                <span className="text-white/40">—</span>
              )}
            </Stat>
          </div>

          {profile?.quality.warnings.length ? (
            <ul className="flex flex-col gap-1 text-[11px] text-white/60">
              {profile.quality.warnings.map((w) => (
                <li key={w} className="flex items-start gap-1.5">
                  <span className="text-white/30 mt-[3px]">—</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/70">Match tolerance (ΔE00)</span>
              <span className="text-white font-semibold">{tolerance.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="2"
              max="20"
              step="0.5"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="w-full accent-white bg-white/10 h-1.5 rounded cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-white/40">
              <span>2 — strict</span>
              <span>10 — same colour family</span>
              <span>20 — loose</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs gap-2">
          {camera.active ? (
            <button
              type="button"
              onClick={sampleLive}
              className="flex items-center gap-1.5 px-3 py-2 rounded bg-white text-black font-semibold hover:bg-white/90 transition-all text-xs"
            >
              <Check className="w-3 h-3" />
              <span>Read reference</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={discard}
              disabled={!calibration.profile}
              className="flex items-center gap-1.5 px-3 py-2 rounded border border-white/20 bg-white/5 hover:bg-white/15 text-white transition-all text-xs disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear saved</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                camera.stop();
                onClose();
              }}
              className="px-3 py-2 rounded text-white/60 hover:text-white transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!profile}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-white text-black font-semibold hover:bg-white/90 transition-all text-xs disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save profile</span>
            </button>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={sampleFile} className="hidden" />
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] text-white/60">{label}</span>
    <div className="glass-input rounded px-3 py-2 text-xs text-white flex items-center justify-between">
      {children}
    </div>
  </div>
);
