import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Link2, Printer, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { ChainVerification, shortHash, verifyChain } from '../lib/integrity';
import { mapsUrl } from '../lib/geo';
import type { TestRecord } from '../types';

interface Props {
  records: TestRecord[];
  onOpenReport: (record: TestRecord) => void;
  onDelete: (id: string) => Promise<void>;
}

export const CaseLog: React.FC<Props> = ({ records, onOpenReport, onDelete }) => {
  const [chain, setChain] = useState<ChainVerification | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!records.length) {
      setChain(null);
      return;
    }
    void verifyChain(records).then((result) => {
      if (!cancelled) setChain(result);
    });
    return () => {
      cancelled = true;
    };
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      [r.caseRef, r.officerName, r.suspectedDrug, r.identifiedSubstance, r.reagentName, r.reason]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [records, query]);

  if (!records.length) {
    return (
      <section
        className="glass-panel rounded-lg p-6 flex items-center gap-4"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        <div className="w-10 h-10 rounded-lg border border-white/20 bg-white/5 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-white/70" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-white">No cases filed yet</span>
          <span className="text-xs text-white/50">
            Filed records stay on this device and survive closing the app.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      className="glass-panel rounded-lg p-6 flex flex-col gap-4"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: 'rgba(255, 255, 255, 0.16) 0px 1px 0px 0px inset',
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-white tracking-wide">Case log</h3>
          <span className="text-xs text-white/50">{records.length} records on this device</span>
        </div>

        {chain && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono ${
              chain.intact ? 'border border-white/25 text-white/80' : 'bg-white text-black font-semibold'
            }`}
            title={
              chain.intact
                ? 'Every record re-hashes to the value stored with it.'
                : 'A record no longer matches its stored hash.'
            }
          >
            {chain.intact ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
            {chain.intact ? `Chain intact · ${chain.checked}` : 'Chain broken'}
          </span>
        )}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by reference, officer, substance or reagent"
        className="glass-input rounded-md px-3 py-2 text-xs text-white placeholder-white/30 w-full"
      />

      <div className="flex flex-col divide-y divide-white/5">
        {filtered.map((record) => {
          const open = expanded === record.id;
          return (
            <div key={record.id} className="py-3 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setExpanded(open ? null : record.id)}
                className="flex items-center justify-between gap-3 text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-6 h-6 rounded border border-white/25 shrink-0"
                    style={{ background: record.hexColor }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-white truncate group-hover:text-white">
                      {record.identifiedSubstance}
                    </span>
                    <span className="font-mono text-[10px] text-white/40 truncate">
                      {record.caseRef} · {new Date(record.createdAt).toLocaleString()} ·{' '}
                      {record.officerName}
                    </span>
                  </div>
                </div>

                <span
                  className={`font-mono text-[10px] px-2 py-0.5 rounded shrink-0 ${
                    record.status === 'positive'
                      ? 'bg-white text-black font-semibold'
                      : 'border border-white/20 text-white/60'
                  }`}
                >
                  {record.status}
                </span>
              </button>

              {open && (
                <div className="flex flex-col gap-3 pl-9">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 font-mono text-[11px]">
                    <Row label="Reagent" value={record.reagentName || '—'} />
                    <Row label="Suspected" value={record.suspectedDrug || '—'} />
                    <Row label="Reason" value={record.reason || '—'} />
                    <Row label="Designation" value={record.designation || '—'} />
                    <Row label="Colour change" value={record.colorShift} />
                    <Row label="Correction" value={record.calibrationSummary} />
                    <Row
                      label="Lab"
                      value={`L ${record.cieLab.L.toFixed(1)} a ${record.cieLab.a.toFixed(1)} b ${record.cieLab.b.toFixed(1)}`}
                    />
                    <Row
                      label="Location"
                      value={
                        record.geo ? (
                          <a
                            href={mapsUrl(record.geo)}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-white/30 hover:decoration-white"
                          >
                            {record.gpsCoords}
                          </a>
                        ) : (
                          record.gpsCoords
                        )
                      }
                    />
                  </div>

                  {record.notes && (
                    <p className="text-[11px] text-white/60 leading-relaxed">{record.notes}</p>
                  )}

                  <div className="flex items-center gap-2 font-mono text-[10px] text-white/40">
                    <Link2 className="w-3 h-3 shrink-0" />
                    <span className="truncate" title={record.sha256Hash}>
                      {shortHash(record.sha256Hash)} ← {shortHash(record.previousHash)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {record.shots.map((shot) => (
                      <ShotThumb key={shot.id} blob={shot.blob} stage={shot.stage} />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenReport(record)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/20 bg-white/5 hover:bg-white/15 text-white text-[11px] transition-all"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Custody report</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete ${record.caseRef}? This breaks the hash chain after it.`)) {
                          void onDelete(record.id);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/15 text-white/50 hover:text-white hover:border-white/30 text-[11px] transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-white/35 text-[9px] uppercase tracking-wider">{label}</span>
    <span className="text-white/75 break-words">{value}</span>
  </div>
);

const ShotThumb: React.FC<{ blob: Blob; stage: string }> = ({ blob, stage }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="relative group">
      <img
        src={url}
        alt={`${stage} frame`}
        className="w-20 h-20 object-cover rounded border border-white/15 group-hover:border-white/40 transition-colors"
      />
      <span className="absolute bottom-1 left-1 font-mono text-[8px] uppercase bg-black/80 text-white/80 px-1 rounded">
        {stage}
      </span>
    </a>
  );
};
