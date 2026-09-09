import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Crosshair,
  Lightbulb,
  Lock,
  RotateCcw,
  SwitchCamera,
  Upload,
} from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { frameToBlob } from '../../lib/imaging';
import { WorkingShot, createShot, measure, releaseShot } from '../../lib/shots';
import type { CaptureStage, SamplePoint } from '../../types';

type MarkerMode = 'reaction' | 'reference';

interface Props {
  stage: CaptureStage;
  shot: WorkingShot | null;
  onShotChange: (shot: WorkingShot | null) => void;
  onCaptured?: (stage: CaptureStage) => void;
  onToast: (title: string, message: string, icon?: string) => void;
  /** Set on the first capture and reused for the second so both share exposure. */
  holdExposure: boolean;
}

const STAGE_COPY: Record<CaptureStage, { title: string; hint: string }> = {
  before: {
    title: 'Before reagent',
    hint: 'Photograph the substance and the reference card together, before anything is added.',
  },
  after: {
    title: 'After reaction',
    hint: 'Same framing, same light. Wait the reagent’s stated read time, then capture.',
  },
};

export const SpecimenViewport: React.FC<Props> = ({
  stage,
  shot,
  onShotChange,
  onCaptured,
  onToast,
  holdExposure,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const camera = useCamera(videoRef);

  const [markerMode, setMarkerMode] = useState<MarkerMode>('reaction');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setMarkerMode('reaction');
    setUploadError(null);
  }, [shot?.id]);

  const ingest = useCallback(
    async (blob: Blob, source: 'camera' | 'upload') => {
      setBusy(true);
      try {
        releaseShot(shot);
        const next = await createShot(blob, stage, source);
        onShotChange(next);
        setMarkerMode('reference');
        onCaptured?.(stage);
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : 'That file could not be read as an image.'
        );
      } finally {
        setBusy(false);
      }
    },
    [onCaptured, onShotChange, shot, stage]
  );

  const capture = async () => {
    if (!videoRef.current) return;
    if (holdExposure) await camera.lockExposure();
    try {
      const blob = await frameToBlob(videoRef.current);
      camera.stop();
      await ingest(blob, 'camera');
      onToast('Photo captured', `${STAGE_COPY[stage].title} frame saved`, 'photo_camera');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Capture failed.');
    }
  };

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('That is not an image file.');
      return;
    }
    void ingest(file, 'upload');
  };

  const placeMarker = async (clientX: number, clientY: number) => {
    const img = imageRef.current;
    if (!img || !shot) return;
    const rect = img.getBoundingClientRect();
    const point: SamplePoint = {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };

    const next =
      markerMode === 'reaction'
        ? await measure(shot, shot.neutralPoint, point)
        : await measure(shot, point, shot.measurement?.point ?? { x: 0.5, y: 0.5 });
    onShotChange(next);
  };

  const clear = () => {
    releaseShot(shot);
    onShotChange(null);
    camera.stop();
  };

  const reaction = shot?.measurement?.point;
  const reference = shot?.neutralPoint;

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file?.type.startsWith('image/')) void ingest(file, 'upload');
        }}
        className={`w-full h-80 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center text-center p-6 relative overflow-hidden ${
          dragging
            ? 'border-white bg-white/10'
            : shot
              ? 'border-white/20 bg-black/60'
              : 'border-white/15 hover:border-white/25 bg-white/[0.02]'
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover bg-black ${
            camera.active ? 'z-10' : 'invisible'
          }`}
        />

        {camera.active ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="absolute inset-8 pointer-events-none border border-white/40 rounded-lg flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white/70" />
            </div>

            <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-20">
              <span className="text-[10px] px-2 py-1 rounded bg-black/70 border border-white/15 text-white/70">
                {STAGE_COPY[stage].title.toUpperCase()}
              </span>
              <div className="flex items-center gap-1.5">
                {camera.capabilities.torch && (
                  <button
                    type="button"
                    onClick={() => camera.setTorch(!camera.torchOn)}
                    className={`p-1.5 rounded border transition-colors ${
                      camera.torchOn
                        ? 'bg-white text-black border-white'
                        : 'bg-black/70 text-white border-white/20 hover:bg-black'
                    }`}
                    title="Torch"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                  </button>
                )}
                {camera.capabilities.lensCount > 1 && (
                  <button
                    type="button"
                    onClick={() => void camera.flip()}
                    className="p-1.5 rounded border border-white/20 bg-black/70 text-white hover:bg-black transition-colors"
                    title="Switch camera"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3 px-4 z-20">
              <button
                type="button"
                onClick={() => void capture()}
                disabled={busy}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-white/90 shadow-lg transition-all disabled:opacity-60"
              >
                <Camera className="w-4 h-4" />
                <span>{busy ? 'Saving…' : 'Capture'}</span>
              </button>
              <button
                type="button"
                onClick={camera.stop}
                className="px-4 py-2.5 rounded-full border border-white/20 bg-black/70 text-white text-xs hover:bg-black transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : shot ? (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center">
            <div className="relative">
              <img
                ref={imageRef}
                src={shot.previewUrl}
                alt={`${STAGE_COPY[stage].title} specimen`}
                onClick={(e) => void placeMarker(e.clientX, e.clientY)}
                className="max-h-72 max-w-full object-contain rounded-lg shadow-xl cursor-crosshair select-none"
                draggable={false}
              />

              {reaction && (
                <Marker
                  point={reaction}
                  active={markerMode === 'reaction'}
                  label="Reaction"
                  swatch={shot.measurement?.hex}
                />
              )}
              {reference ? (
                <Marker point={reference} active={markerMode === 'reference'} label="Reference" dashed />
              ) : (
                <div className="absolute top-2 left-2 right-2 flex items-center gap-1.5 px-2 py-1.5 rounded bg-white text-black text-[10px] font-semibold">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>No reference card marked — colour is uncorrected</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 max-w-sm">
            <div className="w-14 h-14 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-white/80 shadow-inner">
              <Camera className="w-6 h-6 text-white" />
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-white tracking-tight">
                {STAGE_COPY[stage].title}
              </h3>
              <p className="text-xs text-white/50 leading-relaxed">{STAGE_COPY[stage].hint}</p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => void camera.start()}
                disabled={camera.starting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-white text-black font-semibold text-xs tracking-wide hover:bg-white/90 transition-all shadow-md disabled:opacity-60"
              >
                <Camera className="w-4 h-4" />
                <span>{camera.starting ? 'Starting…' : 'Take a picture'}</span>
              </button>

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-md border border-white/20 bg-white/5 hover:bg-white/10 text-white font-medium text-xs tracking-wide transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Upload image</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {(camera.error || uploadError) && (
        <div className="text-xs text-white/70 bg-white/5 border border-white/15 p-3 rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-white/80 shrink-0" />
          <span>{camera.error ?? uploadError}</span>
        </div>
      )}

      {shot && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex border border-white/20 rounded p-0.5 bg-black">
            {(['reaction', 'reference'] as MarkerMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setMarkerMode(mode)}
                className={`px-2.5 py-1 rounded text-[10px] transition-colors ${
                  markerMode === mode ? 'bg-white text-black font-semibold' : 'text-white/60 hover:text-white'
                }`}
              >
                {mode === 'reaction' ? 'Reaction point' : 'Reference patch'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            {camera.locked && (
              <span className="flex items-center gap-1 text-white/60">
                <Lock className="w-3 h-3" />
                Exposure held
              </span>
            )}
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retake</span>
            </button>
          </div>
        </div>
      )}

      {shot?.calibration && !shot.calibration.quality.usable && (
        <div className="text-xs text-white/80 bg-white/10 border border-white/25 p-3 rounded flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            That patch cannot be used as a reference.{' '}
            {shot.calibration.quality.warnings[0]}
          </span>
        </div>
      )}

      {shot && (
        <p className="text-[11px] text-white/40 leading-relaxed flex items-start gap-1.5">
          <Crosshair className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            {markerMode === 'reaction'
              ? 'Tap the reaction zone to move the reading point.'
              : reference
                ? 'Tap the grey or white card to move the reference patch.'
                : 'Tap the grey or white card in the photo. Without it, the colour is uncorrected.'}
          </span>
        </p>
      )}

      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
    </div>
  );
};

const Marker: React.FC<{
  point: SamplePoint;
  active: boolean;
  label: string;
  dashed?: boolean;
  swatch?: string;
}> = ({ point, active, label, dashed, swatch }) => (
  <div
    className="absolute pointer-events-none transition-opacity"
    style={{
      left: `${point.x * 100}%`,
      top: `${point.y * 100}%`,
      transform: 'translate(-50%, -50%)',
      opacity: active ? 1 : 0.55,
    }}
  >
    <div
      className={`w-9 h-9 rounded-full border-2 ${dashed ? 'border-dashed' : ''} ${
        active ? 'border-white' : 'border-white/60'
      } flex items-center justify-center`}
      style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(0,0,0,0.7)' }}
    >
      {swatch ? (
        <span className="w-3.5 h-3.5 rounded-full border border-black/60" style={{ background: swatch }} />
      ) : (
        <span className="w-1 h-1 rounded-full bg-white" />
      )}
    </div>
    <span className="absolute left-1/2 -translate-x-1/2 top-10 whitespace-nowrap font-mono text-[9px] text-white bg-black/80 px-1.5 py-0.5 rounded border border-white/20">
      {label}
    </span>
  </div>
);
