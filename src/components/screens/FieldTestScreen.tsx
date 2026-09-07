import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle,
  ExternalLink,
  Lock,
  MapPin,
  Printer,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { SpecimenViewport } from '../capture/SpecimenViewport';
import { CaseLog } from '../CaseLog';
import { deltaE2000, describeHue } from '../../lib/color';
import { GeoError, formatFix, getFix } from '../../lib/geo';
import { GENESIS_HASH, hashRecord, shortHash } from '../../lib/integrity';
import { describeMatch, matchColour } from '../../lib/reagents';
import {
  WorkingShot,
  applyStoredProfile,
  releaseShot,
  stripPreview,
} from '../../lib/shots';
import type {
  CalibrationProfile,
  CaptureStage,
  GeoFix,
  ReagentProfile,
  TestRecord,
} from '../../types';

interface Props {
  reagents: ReagentProfile[];
  records: TestRecord[];
  profile: CalibrationProfile | null;
  onSaveRecord: (record: TestRecord) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onOpenReport: (record: TestRecord) => void;
  onOpenCalibration: () => void;
  onTriggerToast: (title: string, msg: string, icon?: string) => void;
}

/** ΔE below this between the before and after frame means nothing happened. */
const NO_REACTION_THRESHOLD = 4;
/** ΔE below this against a registry colour counts as a match worth reporting. */
const MATCH_THRESHOLD = 10;

const emptyForm = {
  officerName: '',
  officerBadge: '',
  designation: '',
  stationUnit: '',
  reason: '',
  suspectedDrug: '',
  notes: '',
};

export const FieldTestScreen: React.FC<Props> = ({
  reagents,
  records,
  profile,
  onSaveRecord,
  onDeleteRecord,
  onOpenReport,
  onOpenCalibration,
  onTriggerToast,
}) => {
  const [form, setForm] = useState(emptyForm);
  const [reagentId, setReagentId] = useState<string>('');
  const [freeTextReagent, setFreeTextReagent] = useState('');

  const [stage, setStage] = useState<CaptureStage>('before');
  const [shots, setShots] = useState<Record<CaptureStage, WorkingShot | null>>({
    before: null,
    after: null,
  });

  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [geoState, setGeoState] = useState<'idle' | 'locating' | 'error'>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);

  const [override, setOverride] = useState<TestRecord['status'] | null>(null);
  const [saving, setSaving] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  useEffect(
    () => () => {
      releaseShot(shotsRef.current.before);
      releaseShot(shotsRef.current.after);
    },
    []
  );

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const selectedReagent = reagents.find((r) => r.id === reagentId) ?? null;
  const reagentName = selectedReagent?.name ?? freeTextReagent;

  // The stored grey-card profile only kicks in when the frame has no reference
  // patch of its own, so an in-frame card always wins.
  const before = useMemo(() => applyStoredProfile(shots.before, profile), [shots.before, profile]);
  const after = useMemo(() => applyStoredProfile(shots.after, profile), [shots.after, profile]);

  const afterMeasurement = after?.measurement ?? null;
  const beforeMeasurement = before?.measurement ?? null;

  /** How far the pouch actually moved. This is the whole point of two photos. */
  const reactionShift =
    beforeMeasurement && afterMeasurement
      ? deltaE2000(beforeMeasurement.lab, afterMeasurement.lab)
      : null;

  const matches = useMemo(
    () =>
      afterMeasurement
        ? matchColour(afterMeasurement.lab, reagents, { reagentId: reagentId || null })
        : [],
    [afterMeasurement, reagents, reagentId]
  );

  const best = matches[0] ?? null;

  const derivedStatus: TestRecord['status'] = !afterMeasurement
    ? 'inconclusive'
    : reactionShift !== null && reactionShift < NO_REACTION_THRESHOLD
      ? 'negative'
      : best && best.deltaE < MATCH_THRESHOLD
        ? 'positive'
        : 'inconclusive';

  const status = override ?? derivedStatus;

  const identified =
    status === 'negative'
      ? 'No colour change detected'
      : status === 'positive' && best
        ? best.analyte
        : afterMeasurement
          ? `Unmatched — ${describeHue(afterMeasurement.lab).toLowerCase()}`
          : 'Awaiting reaction photo';

  const matchQuality = describeMatch(status === 'negative' ? null : (best?.deltaE ?? null));

  const colourShift =
    beforeMeasurement && afterMeasurement
      ? `${describeHue(beforeMeasurement.lab)} → ${describeHue(afterMeasurement.lab)} (ΔE ${reactionShift!.toFixed(1)})`
      : afterMeasurement
        ? `${describeHue(afterMeasurement.lab)}, no baseline frame`
        : 'Not measured';

  const correctionLabel = afterMeasurement?.correctedBy ?? 'none';
  const uncorrected = Boolean(afterMeasurement) && correctionLabel === 'none';

  const setShot = (target: CaptureStage) => (shot: WorkingShot | null) =>
    setShots((prev) => ({ ...prev, [target]: shot }));

  const locate = async () => {
    setGeoState('locating');
    setGeoError(null);
    try {
      const fix = await getFix();
      setGeo(fix);
      setGeoState('idle');
      onTriggerToast('Location recorded', `Accurate to ${fix.accuracyM} m`, 'check');
      return fix;
    } catch (err) {
      const message = err instanceof GeoError ? err.message : 'Location unavailable.';
      setGeoError(message);
      setGeoState('error');
      return null;
    }
  };

  const reset = () => {
    releaseShot(shots.before);
    releaseShot(shots.after);
    setShots({ before: null, after: null });
    setStage('before');
    setOverride(null);
    setForm((f) => ({ ...f, suspectedDrug: '', reason: f.reason, notes: '' }));
  };

  const save = async () => {
    if (!shots.before && !shots.after) {
      onTriggerToast('Nothing to file', 'Capture at least one photo first', 'alert');
      return;
    }
    setSaving(true);
    try {
      const fix = geo ?? (await locate());
      const previous = records[0] ?? null;
      const sequence = previous ? previous.sequence + 1 : 1;
      const now = new Date();

      // `before`/`after` carry the stored-profile correction; the raw slots do not.
      const enriched = [before, after].filter((s): s is WorkingShot => s !== null);

      const draft: Omit<TestRecord, 'sha256Hash'> = {
        id: `case-${crypto.randomUUID()}`,
        caseRef: `DT-${now.getFullYear()}-${String(sequence).padStart(4, '0')}`,
        timestampUtc: now.toISOString(),
        createdAt: now.toISOString(),
        officerName: form.officerName.trim() || 'Unnamed officer',
        officerBadge: form.officerBadge.trim(),
        designation: form.designation.trim(),
        stationUnit: form.stationUnit.trim(),
        reason: form.reason.trim(),
        reagentName: reagentName.trim(),
        reagentId: selectedReagent?.id ?? null,
        suspectedDrug: form.suspectedDrug.trim(),
        identifiedSubstance: identified,
        status,
        certainty: matchQuality.label,
        colorShift: colourShift,
        hexColor: afterMeasurement?.hex ?? '#000000',
        cieLab: afterMeasurement?.lab ?? { L: 0, a: 0, b: 0 },
        wavelengthPeakNm: selectedReagent?.absorbancePeakNm ?? 0,
        deltaE: best?.deltaE ?? null,
        matches,
        notes: form.notes.trim(),
        gpsCoords: formatFix(fix),
        geo: fix,
        shots: enriched.map(stripPreview),
        calibrationSummary:
          correctionLabel === 'in-frame reference'
            ? 'Corrected against a reference patch inside the frame'
            : correctionLabel === 'stored profile'
              ? 'Corrected against the stored grey-card profile'
              : 'No colour correction applied',
        previousHash: previous?.sha256Hash ?? GENESIS_HASH,
        sequence,
        locked: true,
        synced: false,
      };

      const record: TestRecord = { ...draft, sha256Hash: await hashRecord(draft) };
      await onSaveRecord(record);
      onTriggerToast('Case filed', `${record.caseRef} · ${shortHash(record.sha256Hash)}`, 'lock');
      reset();
    } catch (err) {
      onTriggerToast(
        'Save failed',
        err instanceof Error ? err.message : 'The record was not written.',
        'alert'
      );
    } finally {
      setSaving(false);
    }
  };

  const printable = (): TestRecord => ({
    id: 'draft',
    caseRef: 'Unsaved draft',
    timestampUtc: clock.toISOString(),
    createdAt: clock.toISOString(),
    officerName: form.officerName || 'Unnamed officer',
    officerBadge: form.officerBadge,
    designation: form.designation,
    stationUnit: form.stationUnit,
    reason: form.reason,
    reagentName,
    reagentId: selectedReagent?.id ?? null,
    suspectedDrug: form.suspectedDrug,
    identifiedSubstance: identified,
    status,
    certainty: matchQuality.label,
    colorShift: colourShift,
    hexColor: afterMeasurement?.hex ?? '#000000',
    cieLab: afterMeasurement?.lab ?? { L: 0, a: 0, b: 0 },
    wavelengthPeakNm: selectedReagent?.absorbancePeakNm ?? 0,
    deltaE: best?.deltaE ?? null,
    matches,
    notes: form.notes,
    gpsCoords: formatFix(geo),
    geo,
    shots: [],
    calibrationSummary: '',
    sha256Hash: GENESIS_HASH,
    previousHash: GENESIS_HASH,
    sequence: 0,
    locked: false,
    synced: false,
  });

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const panel = {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(28px) saturate(190%)',
    border: '1px solid rgba(255, 255, 255, 0.16)',
    boxShadow:
      'rgba(255, 255, 255, 0.22) 0px 1px 0px 0px inset, rgba(0, 0, 0, 0.7) 0px 20px 40px -15px',
  } as const;

  return (
    <div id="field-test-intake-screen" className="max-w-6xl mx-auto flex flex-col gap-6">
      <div
        className="glass-panel rounded-lg px-5 py-3 flex flex-wrap items-center justify-between gap-4 font-sans text-xs"
        style={{ ...panel, boxShadow: 'rgba(255, 255, 255, 0.22) 0px 1px 0px 0px inset, rgba(0, 0, 0, 0.6) 0px 15px 30px -10px' }}
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-4 h-4 text-white/80" />
          <span className="text-white font-medium">
            {form.stationUnit.trim() || 'Station not set'}
          </span>
          <span className="text-white/40">•</span>
          <span className="text-white/60">Intake &amp; documentation</span>
        </div>
        <button
          type="button"
          onClick={() => void locate()}
          className="flex items-center gap-2 text-white/60 hover:text-white font-mono text-[11px] transition-colors"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>
            {geoState === 'locating'
              ? 'Locating…'
              : geo
                ? formatFix(geo)
                : geoError ?? 'Tap to record location'}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <section className="glass-panel rounded-lg p-6 flex flex-col gap-5" style={panel}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-semibold text-white tracking-wide">Test specimen photos</h2>
                <p className="text-xs text-white/50">
                  Two frames: one before the reagent, one after. Keep the reference card in both.
                </p>
              </div>

              <div className="inline-flex border border-white/20 rounded p-0.5 bg-black self-start">
                {(['before', 'after'] as CaptureStage[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStage(s)}
                    className={`px-2.5 py-1 rounded font-mono text-[10px] transition-colors flex items-center gap-1.5 ${
                      stage === s ? 'bg-white text-black font-semibold' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {shots[s] && (
                      <span
                        className="w-2 h-2 rounded-full border border-current"
                        style={{ background: shots[s]!.measurement?.hex ?? 'transparent' }}
                      />
                    )}
                    <span>{s === 'before' ? 'Before' : 'After'}</span>
                  </button>
                ))}
              </div>
            </div>

            <SpecimenViewport
              stage={stage}
              shot={shots[stage]}
              onShotChange={setShot(stage)}
              onToast={onTriggerToast}
              holdExposure={stage === 'before'}
            />

            {uncorrected && (
              <button
                type="button"
                onClick={onOpenCalibration}
                className="text-xs text-white/70 bg-white/5 border border-white/15 p-3 rounded flex items-center gap-2 text-left hover:bg-white/10 transition-colors"
              >
                <Sliders className="w-4 h-4 text-white/80 shrink-0" />
                <span>
                  This reading is uncorrected. Mark a reference patch in the photo, or calibrate
                  against a grey card first.
                </span>
              </button>
            )}
          </section>

          <section className="glass-panel rounded-lg p-6 flex flex-col gap-5" style={panel}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  Test details &amp; officer information
                </h3>
                <p className="text-xs text-white/50">Recorded with the photos and sealed on save.</p>
              </div>
              <span className="text-xs font-mono text-white/50 px-2 py-0.5 rounded border border-white/10 bg-white/5">
                {clock.toISOString().slice(11, 19)} UTC
              </span>
            </div>

            <form
              id="metadata-intake-form"
              onSubmit={(e) => e.preventDefault()}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <Field label="Officer name" htmlFor="field-officer-name">
                <input
                  id="field-officer-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Full name"
                  {...field('officerName')}
                  className="glass-input rounded-md px-3 py-2 text-xs text-white placeholder-white/30"
                />
              </Field>

              <Field label="Badge or service number" htmlFor="field-officer-badge">
                <input
                  id="field-officer-badge"
                  type="text"
                  placeholder="Optional"
                  {...field('officerBadge')}
                  className="glass-input rounded-md px-3 py-2 text-xs text-white placeholder-white/30 font-mono"
                />
              </Field>

              <Field label="Designation" htmlFor="field-designation">
                <input
                  id="field-designation"
                  type="text"
                  placeholder="Rank or role"
                  {...field('designation')}
                  className="glass-input rounded-md px-3 py-2 text-xs text-white placeholder-white/30"
                />
              </Field>

              <Field label="Station or unit" htmlFor="field-station">
                <input
                  id="field-station"
                  type="text"
                  placeholder="Posting"
                  {...field('stationUnit')}
                  className="glass-input rounded-md px-3 py-2 text-xs text-white placeholder-white/30"
                />
              </Field>

              <Field label="Reason for test" htmlFor="field-reason">
                <input
                  id="field-reason"
                  type="text"
                  placeholder="Why this test is being carried out"
                  {...field('reason')}
                  className="glass-input rounded-md px-3 py-2 text-xs text-white placeholder-white/30"
                />
              </Field>

              <Field label="Suspected substance" htmlFor="field-suspected-drug">
                <input
                  id="field-suspected-drug"
                  type="text"
                  placeholder="What you expect it to be"
                  {...field('suspectedDrug')}
                  className="glass-input rounded-md px-3 py-2 text-xs text-white placeholder-white/30"
                />
              </Field>

              <Field label="Reagent used" htmlFor="field-reagent-name" className="md:col-span-2">
                {reagents.length ? (
                  <select
                    id="field-reagent-name"
                    value={reagentId}
                    onChange={(e) => setReagentId(e.target.value)}
                    className="glass-input rounded-md px-3 py-2 text-xs text-white bg-black"
                  >
                    <option value="">Not specified — compare against all reagents</option>
                    {reagents.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.targetAnalytes.length ? ` — ${r.targetAnalytes.join(', ')}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="field-reagent-name"
                    type="text"
                    placeholder="Registry is empty — type the reagent name"
                    value={freeTextReagent}
                    onChange={(e) => setFreeTextReagent(e.target.value)}
                    className="glass-input rounded-md px-3 py-2 text-xs text-white placeholder-white/30"
                  />
                )}
              </Field>

              <Field label="Notes" htmlFor="field-notes" className="md:col-span-2">
                <textarea
                  id="field-notes"
                  rows={2}
                  placeholder="Anything that affects how this reading should be read later"
                  {...field('notes')}
                  className="glass-input rounded-md px-3 py-2 text-xs text-white placeholder-white/30"
                />
              </Field>
            </form>
          </section>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <section className="glass-panel rounded-lg p-6 flex flex-col gap-5" style={panel}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 gap-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-white tracking-wide">Presumptive result</h3>
                <span className="text-xs text-white/50">
                  {override ? 'Set manually' : 'Read from the photos'}
                </span>
              </div>

              <div className="inline-flex border border-white/20 rounded p-0.5 bg-black shrink-0">
                {(['positive', 'inconclusive', 'negative'] as TestRecord['status'][]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setOverride(override === s ? null : s)}
                    className={`px-2 py-1 rounded font-mono text-[10px] transition-colors capitalize ${
                      status === s ? 'bg-white text-black font-semibold' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {s === 'inconclusive' ? 'Unclear' : s === 'positive' ? 'Pos' : 'Neg'}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="glass-panel-elevated rounded-lg p-5 flex flex-col gap-4"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: 'rgba(255, 255, 255, 0.15) 0px 1px 0px 0px inset',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60 font-medium">Status</span>
                <span
                  id="status-badge"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
                    status === 'positive' ? 'bg-white text-black' : 'border border-white/30 text-white'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${status === 'positive' ? 'bg-black' : 'bg-white'}`} />
                  <span>
                    {status === 'positive'
                      ? 'Presumptive positive'
                      : status === 'negative'
                        ? 'No reaction'
                        : 'Inconclusive'}
                  </span>
                </span>
              </div>

              <div className="border-b border-white/10 pb-3">
                <div className="text-xs text-white/50">Closest registry entry</div>
                <div className="text-lg font-semibold text-white mt-1 tracking-tight">{identified}</div>
              </div>

              <div className="flex flex-col gap-2.5 text-xs">
                <Readout label="Match quality" title={matchQuality.detail}>
                  <span className="font-mono">
                    {matchQuality.label}
                    {best && status !== 'negative' && (
                      <span className="text-white/40"> · ΔE {best.deltaE.toFixed(1)}</span>
                    )}
                  </span>
                </Readout>

                <Readout label="Reagent">{reagentName || <span className="text-white/40">Not specified</span>}</Readout>

                <Readout label="Measured colour">
                  {afterMeasurement ? (
                    <span className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full border border-white/30 inline-block shrink-0"
                        style={{ backgroundColor: afterMeasurement.hex }}
                      />
                      <span className="font-mono">{afterMeasurement.hex}</span>
                    </span>
                  ) : (
                    <span className="text-white/40">Awaiting photo</span>
                  )}
                </Readout>

                <Readout label="Colour change">
                  <span className="text-right">{colourShift}</span>
                </Readout>

                <Readout label="Correction">
                  <span className={uncorrected ? 'text-white/50' : ''}>
                    {correctionLabel === 'none' ? 'None applied' : correctionLabel}
                  </span>
                </Readout>

                <Readout label="Location">
                  <span className="font-mono text-white/70 text-right">{formatFix(geo)}</span>
                </Readout>
              </div>
            </div>

            {matches.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                  Other candidates
                </span>
                {matches.slice(1).map((m) => (
                  <div
                    key={`${m.reagentId}-${m.analyte}-${m.referenceHex}`}
                    className="flex items-center justify-between text-[11px] py-1 border-b border-white/5 last:border-0"
                  >
                    <span className="flex items-center gap-2 text-white/70">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0"
                        style={{ backgroundColor: m.referenceHex }}
                      />
                      <span className="truncate max-w-[150px]">{m.analyte}</span>
                    </span>
                    <span className="font-mono text-white/50">ΔE {m.deltaE.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}

            {!reagents.length && (
              <div className="text-xs text-white/60 bg-white/5 border border-white/15 p-3 rounded flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
                <span>
                  The reagent registry is empty, so nothing can be matched. Photos, colours and
                  metadata are still recorded — import the registry on the Reagents page to turn
                  readings into candidates.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                id="btn-save-record"
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-white text-black hover:bg-white/90 font-medium text-xs tracking-wide transition-all shadow-lg disabled:opacity-60"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{saving ? 'Filing…' : 'File case record'}</span>
              </button>

              <button
                id="btn-print-report"
                type="button"
                onClick={() => onOpenReport(printable())}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md border border-white/20 bg-white/5 hover:bg-white/10 text-white font-medium text-xs tracking-wide transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Preview custody report</span>
              </button>
            </div>
          </section>

          <div
            className="glass-panel rounded-lg p-4 flex items-center justify-between text-xs"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: 'rgba(255, 255, 255, 0.15) 0px 1px 0px 0px inset',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded border border-white/20 flex items-center justify-center bg-white/5">
                <Lock className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-medium">Records are hash-chained on save</span>
                <span className="text-white/40 text-[10px] font-mono">
                  {records.length
                    ? `${records.length} filed · head ${shortHash(records[0].sha256Hash)}`
                    : 'No records yet'}
                </span>
              </div>
            </div>
            <Check className="w-4 h-4 text-white/70" />
          </div>
        </div>
      </div>

      <CaseLog records={records} onOpenReport={onOpenReport} onDelete={onDeleteRecord} />

      {/* Lives in /public, so it opens as a plain page the officer can print
          from any browser without going through the app. */}
      <a
        href="/reference-card.html"
        target="_blank"
        rel="noreferrer"
        className="glass-panel rounded-lg px-5 py-4 flex flex-wrap items-center justify-between gap-3 hover:bg-white/[0.06] transition-colors group"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded border border-white/20 bg-white/5 flex items-center justify-center shrink-0">
            <Printer className="w-4 h-4 text-white/80" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-white">Print the reference card</span>
            <span className="text-[11px] text-white/50">
              Matte paper, 100% scale, printer colour correction off
            </span>
          </div>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-white/50 group-hover:text-white transition-colors shrink-0">
          <span>Opens in a new tab</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </span>
      </a>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, htmlFor, className = '', children }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label className="text-xs font-medium text-white/70" htmlFor={htmlFor}>
      {label}
    </label>
    {children}
  </div>
);

const Readout: React.FC<{ label: string; title?: string; children: React.ReactNode }> = ({
  label,
  title,
  children,
}) => (
  <div className="flex items-center justify-between gap-3 py-1 border-b border-white/5" title={title}>
    <span className="text-white/50 shrink-0">{label}</span>
    <span className="text-white font-medium text-right">{children}</span>
  </div>
);
