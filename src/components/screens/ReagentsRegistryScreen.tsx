import React, { useState } from 'react';
import {
  FlaskConical,
  Plus,
  Upload,
  ArrowRight,
  Palette,
  Hourglass,
  Microscope,
  Check,
  Search,
  Lock,
  Unlock,
  RotateCcw,
  Download,
  AlertTriangle
} from 'lucide-react';
import { ReagentProfile } from '../../types';

interface ReagentsRegistryScreenProps {
  reagents: ReagentProfile[];
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  onClearRegistry: () => void;
  onExportRegistry: () => void;
  onTriggerToast: (title: string, msg: string, icon?: string) => void;
}

/** Days from today, or null when the entry has no parseable expiry. */
function daysUntil(dateish: string): number | null {
  const t = Date.parse(dateish);
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86400000);
}

export const ReagentsRegistryScreen: React.FC<ReagentsRegistryScreenProps> = ({
  reagents,
  onOpenAddModal,
  onOpenImportModal,
  onClearRegistry,
  onExportRegistry,
  onTriggerToast,
}) => {
  const [isLocked, setIsLocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReagent, setSelectedReagent] = useState<ReagentProfile | null>(null);

  const isConfigured = reagents.length > 0;

  const stats = React.useMemo(() => {
    const imported = reagents.filter((r) => r.source === 'import').length;
    const withColour = reagents.filter((r) => r.hexColor !== '#000000').length;
    const colourStates = reagents.reduce(
      (acc, r) => acc + (r.colorStates.length || 1),
      0
    );
    const dated = reagents.map((r) => daysUntil(r.expirationDate));
    const withExpiry = dated.filter((d): d is number => d !== null);
    return {
      imported,
      manual: reagents.length - imported,
      withColour,
      colourStates,
      analytes: new Set(reagents.flatMap((r) => r.targetAnalytes)).size,
      expired: withExpiry.filter((d) => d < 0).length,
      expiringSoon: withExpiry.filter((d) => d >= 0 && d <= 60).length,
      withExpiry: withExpiry.length,
    };
  }, [reagents]);

  const toggleLock = () => {
    setIsLocked(!isLocked);
    onTriggerToast(
      isLocked ? 'Registry unlocked' : 'Registry locked',
      isLocked ? 'Entries can be edited again' : 'Entries are read-only until unlocked',
      isLocked ? 'tune' : 'lock'
    );
  };

  const filteredReagents = reagents.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.targetAnalytes.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.chemicalMatrix.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="reagents-registry-screen" className="max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[11px] font-mono text-white/50 tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            <span>REAGENT REFERENCE DATA</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight font-sans uppercase">
            REAGENT REGISTRY
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Reference colours for every reagent in the kit. Readings taken on the field test page
            are matched against these entries.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start font-mono text-xs border border-white/15 bg-white/5 px-3 py-2 rounded">
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-[10px]">ENTRIES:</span>
            <span className="text-white font-semibold tracking-wide">
              {isConfigured ? `${reagents.length} LOADED` : 'EMPTY'}
            </span>
          </div>
          <span className="text-white/20">|</span>
          <button
            onClick={toggleLock}
            className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
            title="Lock the registry against edits"
          >
            {isLocked ? (
              <>
                <Lock className="w-3 h-3 text-white" />
                <span className="text-[10px] text-white font-semibold">LOCKED</span>
              </>
            ) : (
              <>
                <Unlock className="w-3 h-3 text-white/60" />
                <span className="text-[10px] text-white/60">UNCOMMITTED</span>
              </>
            )}
          </button>
        </div>
      </div>

      {!isConfigured ? (
        <div
          className="w-full rounded-xl border border-white/15 p-8 lg:p-12 flex flex-col items-center justify-center text-center relative overflow-hidden grid-mesh shadow-2xl"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(24px) saturate(180%)',
            boxShadow:
              'rgba(255, 255, 255, 0.16) 0px 1px 0px 0px inset, rgba(0, 0, 0, 0.8) 0px 25px 50px -12px',
          }}
        >
          <div className="w-16 h-16 rounded-xl border border-white/25 bg-white/5 flex items-center justify-center mb-5 shadow-inner">
            <FlaskConical className="w-7 h-7 text-white/80" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/15 bg-white/5 font-mono text-[10px] tracking-widest text-white/70 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            <span>NOTHING LOADED</span>
          </div>

          <h2 className="text-xl lg:text-2xl font-bold text-white tracking-tight mb-2">
            Reagent registry
          </h2>
          <p className="text-xs text-white/60 max-w-xl leading-relaxed mb-6">
            Nothing is loaded yet. Import a reagent data sheet, or add entries one at a time.
            Every reagent needs a name and at least one reference colour — that colour is what
            photographed reactions are compared against.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <button
              id="btn-add-reagent-profile"
              type="button"
              onClick={onOpenAddModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded bg-white text-black font-semibold text-xs tracking-wider uppercase hover:bg-white/90 transition-all shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>ADD A REAGENT</span>
            </button>

            <button
              id="btn-import-datasheet"
              type="button"
              onClick={onOpenImportModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded border border-white/20 bg-white/5 hover:bg-white/15 text-white font-medium text-xs tracking-wider uppercase transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>IMPORT DATA SHEET</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[10px] text-white/40">
            <span className="uppercase tracking-widest">Accepted:</span>
            <span className="px-2 py-1 rounded border border-white/15 bg-white/[0.03] text-white/60">
              .json — array of reagents
            </span>
            <span className="px-2 py-1 rounded border border-white/15 bg-white/[0.03] text-white/60">
              .csv — one reagent per row
            </span>
          </div>
        </div>
      ) : (
        <div
          className="w-full rounded-xl border border-white/15 p-6 flex flex-col gap-5 relative overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(24px) saturate(180%)',
            boxShadow:
              'rgba(255, 255, 255, 0.16) 0px 1px 0px 0px inset, rgba(0, 0, 0, 0.8) 0px 25px 50px -12px',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg border border-white/30 bg-white/10 flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">Loaded reagents</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white text-black font-semibold">
                    {reagents.length} LOADED
                  </span>
                </div>
                <span className="font-mono text-[11px] text-white/50">
                  STORED ON THIS DEVICE
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenAddModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white text-black font-semibold text-xs hover:bg-white/90 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add reagent</span>
              </button>
              <button
                type="button"
                onClick={onOpenImportModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/20 bg-white/5 hover:bg-white/15 text-white text-xs font-mono transition-all"
              >
                <Upload className="w-3 h-3" />
                <span>Import</span>
              </button>
              <button
                type="button"
                onClick={onExportRegistry}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/20 bg-white/5 hover:bg-white/15 text-white text-xs font-mono transition-all"
                title="Download the registry as JSON"
              >
                <Download className="w-3 h-3" />
                <span>Export</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remove all ${reagents.length} reagents from the registry?`)) {
                    onClearRegistry();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/20 bg-white/5 hover:bg-white/15 text-white text-xs font-mono transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 glass-input rounded-md px-3 py-2 text-xs">
            <Search className="w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search by reagent name or substance"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-white placeholder-white/30 w-full focus:outline-none text-xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {filteredReagents.map((reagent) => (
              <div
                key={reagent.id}
                onClick={() => setSelectedReagent(reagent)}
                className="p-3.5 rounded-lg border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition-all cursor-pointer flex flex-col justify-between gap-3 relative group"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-white/40">
                    <span>{reagent.targetAnalytes.length} target{reagent.targetAnalytes.length === 1 ? '' : 's'}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                        reagent.status === 'active'
                          ? 'text-white border border-white/20'
                          : 'text-white/60 border border-white/10'
                      }`}
                    >
                      {reagent.lotNumber}
                    </span>
                  </div>

                  <div className="font-semibold text-white text-xs font-sans group-hover:text-white">
                    {reagent.name}
                  </div>

                  <div className="text-[11px] text-white/60 line-clamp-1">
                    {reagent.chemicalMatrix || reagent.targetAnalytes.join(', ')}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[10px] font-mono">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                      style={{ backgroundColor: reagent.hexColor }}
                    ></span>
                    <span className="text-white/70 truncate max-w-[110px]">
                      {reagent.colorStates.length > 1
                        ? `${reagent.colorStates.length} colours`
                        : reagent.reactionColor || 'Reference colour'}
                    </span>
                  </div>
                  {reagent.status === 'uncommitted' ? (
                    <span className="flex items-center gap-1 text-white/50" title="No usable colour, so this entry cannot be matched">
                      <AlertTriangle className="w-3 h-3" />
                      <span>no colour</span>
                    </span>
                  ) : (
                    <span className="text-white/50">
                      {reagent.absorbancePeakNm ? `${reagent.absorbancePeakNm} nm` : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedReagent && (
        <div className="glass-panel-elevated rounded-lg p-5 border border-white/25 flex flex-col gap-3 font-mono text-xs animate-in fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/40"
                style={{ backgroundColor: selectedReagent.hexColor }}
              ></span>
              <span className="text-sm font-bold text-white font-sans">
                {selectedReagent.name}
              </span>
              
            </div>
            <button
              onClick={() => setSelectedReagent(null)}
              className="text-white/60 hover:text-white text-xs"
            >
              Close ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-white/80">
            <div>
              <span className="text-white/40 text-[10px] block">COMPOSITION</span>
              <span>{selectedReagent.chemicalMatrix}</span>
            </div>
            <div>
              <span className="text-white/40 text-[10px] block">DETECTS</span>
              <span>{selectedReagent.targetAnalytes.join(', ')}</span>
            </div>
            <div>
              <span className="text-white/40 text-[10px] block">LOT AND STORAGE</span>
              <span>
                {selectedReagent.lotNumber} • Exp: {selectedReagent.expirationDate} ({selectedReagent.tempLimitC})
              </span>
            </div>
          </div>
          {selectedReagent.colorStates.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2">
              <span className="text-white/40 text-[10px]">REFERENCE COLOURS</span>
              {selectedReagent.colorStates.map((state, i) => (
                <div
                  key={`${state.hex}-${i}`}
                  className="flex items-center justify-between gap-3 text-[11px]"
                >
                  <span className="flex items-center gap-2 text-white/80 min-w-0">
                    <span
                      className="w-3 h-3 rounded border border-white/30 shrink-0"
                      style={{ backgroundColor: state.hex }}
                    />
                    <span className="truncate">{state.analyte}</span>
                    <span className="text-white/40 truncate">{state.label}</span>
                  </span>
                  <span className="text-white/40 shrink-0">
                    {state.hex}
                    {state.atSeconds ? ` · ${state.atSeconds}s` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {selectedReagent.description && (
            <div className="text-[11px] text-white/60 font-sans">{selectedReagent.description}</div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold uppercase tracking-wider">
              REGISTRY OVERVIEW
            </span>
            <span className="px-2 py-0.5 rounded border border-white/15 bg-white/5 text-[10px] text-white/60">
              {reagents.length} ENTRIES
            </span>
          </div>
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            {isConfigured ? 'STORED ON THIS DEVICE' : 'NOTHING STORED YET'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div
            className="glass-panel rounded-lg p-5 flex flex-col justify-between gap-5 border border-white/15 hover:border-white/30 transition-all group"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(20px)',
              boxShadow: 'rgba(255, 255, 255, 0.15) 0px 1px 0px 0px inset',
            }}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded border border-white/20 bg-white/5 flex items-center justify-center">
                  <Microscope className="w-4 h-4 text-white" />
                </div>
                <span className="font-mono text-[9px] tracking-wider text-white/40 uppercase border border-white/10 px-2 py-0.5 rounded bg-white/[0.02]">
                  {isConfigured ? `${reagents.length} LOADED` : 'EMPTY'}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-bold text-white tracking-tight">What is loaded</h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  Everything loaded into the registry, whether imported in bulk or added by hand.
                </p>
              </div>

              <div className="flex flex-col gap-2 font-mono text-[10px] text-white/40">
                <StatBar label="IMPORTED" value={stats.imported} total={reagents.length} />
                <StatBar label="ADDED BY HAND" value={stats.manual} total={reagents.length} />
                <StatBar label="MATCHABLE" value={stats.withColour} total={reagents.length} />
              </div>
            </div>

            <div className="flex items-center justify-between font-mono text-[11px] text-white/60 border-t border-white/10 pt-3">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                <span>
                  {isConfigured
                    ? `${reagents.length} entries · ${stats.analytes} analytes`
                    : 'Awaiting entries'}
                </span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-white/50 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div
            className="glass-panel rounded-lg p-5 flex flex-col justify-between gap-5 border border-white/15 hover:border-white/30 transition-all group"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(20px)',
              boxShadow: 'rgba(255, 255, 255, 0.15) 0px 1px 0px 0px inset',
            }}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded border border-white/20 bg-white/5 flex items-center justify-center">
                  <Palette className="w-4 h-4 text-white" />
                </div>
                <span className="font-mono text-[9px] tracking-wider text-white/40 uppercase border border-white/10 px-2 py-0.5 rounded bg-white/[0.02]">
                  {stats.colourStates ? `${stats.colourStates} COLOURS` : 'EMPTY'}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Reference colours
                </h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  The reference colours a photographed reaction is compared against, one per
                  reagent or one per analyte where the kit distinguishes them.
                </p>
              </div>

              <div className="grid grid-cols-6 gap-1.5 h-6">
                {isConfigured ? (
                  reagents.slice(0, 6).map((r) => (
                    <div
                      key={r.id}
                      className="rounded border border-white/20 h-full"
                      style={{ backgroundColor: r.hexColor }}
                      title={`${r.name} (${r.reactionColor})`}
                    />
                  ))
                ) : (
                  <>
                    <div className="rounded border border-white/15 bg-white/5 h-full"></div>
                    <div className="rounded border border-white/15 bg-white/5 h-full"></div>
                    <div className="rounded border border-white/15 bg-white/5 h-full"></div>
                    <div className="rounded border border-white/15 bg-white/5 h-full"></div>
                    <div className="rounded border border-white/15 bg-white/5 h-full"></div>
                    <div className="rounded border border-white/15 bg-white/5 h-full"></div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between font-mono text-[11px] text-white/60 border-t border-white/10 pt-3">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                <span>
                  {isConfigured
                    ? `${stats.colourStates} reference colour${stats.colourStates === 1 ? '' : 's'}`
                    : 'No reference colours'}
                </span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-white/50 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div
            className="glass-panel rounded-lg p-5 flex flex-col justify-between gap-5 border border-white/15 hover:border-white/30 transition-all group"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(20px)',
              boxShadow: 'rgba(255, 255, 255, 0.15) 0px 1px 0px 0px inset',
            }}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded border border-white/20 bg-white/5 flex items-center justify-center">
                  <Hourglass className="w-4 h-4 text-white" />
                </div>
                <span className="font-mono text-[9px] tracking-wider text-white/40 uppercase border border-white/10 px-2 py-0.5 rounded bg-white/[0.02]">
                  {stats.withExpiry ? `${stats.withExpiry} DATED` : 'NO DATES'}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Expiry &amp; shelf life
                </h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  An expired reagent produces the wrong colour rather than no colour, so entries
                  past their date are flagged before a reading is trusted.
                </p>
              </div>

              <div className="flex items-center justify-between font-mono text-[10px] text-white/40 pt-2">
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mr-3">
                  <div
                    className="h-full bg-white"
                    style={{
                      width: stats.withExpiry
                        ? `${Math.round(((stats.withExpiry - stats.expired) / stats.withExpiry) * 100)}%`
                        : '0%',
                    }}
                  />
                </div>
                <span className="shrink-0">
                  {stats.withExpiry ? `${stats.withExpiry - stats.expired} / ${stats.withExpiry}` : '— / —'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between font-mono text-[11px] text-white/60 border-t border-white/10 pt-3">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                <span>
                  {!stats.withExpiry
                    ? 'No expiry dates supplied'
                    : stats.expired
                      ? `${stats.expired} expired`
                      : stats.expiringSoon
                        ? `${stats.expiringSoon} expiring within 60 days`
                        : 'All in date'}
                </span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-white/50 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatBar: React.FC<{ label: string; value: number; total: number }> = ({
  label,
  value,
  total,
}) => (
  <div className="flex items-center justify-between gap-3">
    <span className="shrink-0">{label}</span>
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-24 h-1.5 rounded-full bg-white/15 overflow-hidden">
        <div
          className="h-full bg-white transition-[width] duration-300"
          style={{ width: total ? `${Math.round((value / total) * 100)}%` : '0%' }}
        />
      </div>
      <span className="w-6 text-right text-white/60">{value}</span>
    </div>
  </div>
);
