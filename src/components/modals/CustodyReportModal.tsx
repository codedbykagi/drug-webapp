import React from 'react';
import { X, Printer, ShieldCheck, Download, CheckCircle, Lock } from 'lucide-react';
import { TestRecord } from '../../types';

interface CustodyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: TestRecord;
  onTriggerToast: (title: string, msg: string, icon?: string) => void;
}

export const CustodyReportModal: React.FC<CustodyReportModalProps> = ({
  isOpen,
  onClose,
  record,
  onTriggerToast,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    onTriggerToast('Opening print dialog', 'Chain-of-custody record ready', 'print');
    window.print();
  };

  return (
    <div
      id="modal-custody-report"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div
        className="w-full max-w-2xl glass-panel-elevated bg-black/95 rounded-lg border border-white/25 p-6 flex flex-col gap-5 shadow-2xl relative my-8"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95), inset 0 1px 0 0 rgba(255, 255, 255, 0.3)',
        }}
      >
        <div className="flex items-center justify-between border-b border-white/15 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded border border-white/30 bg-white/10 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-xs font-bold text-white tracking-widest uppercase">
                FIELD TEST RECORD // CHAIN OF CUSTODY
              </span>
              <span className="font-mono text-[10px] text-white/50">
                PRESUMPTIVE COLOUR TEST — LABORATORY CONFIRMATION REQUIRED
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-white/20 bg-white/10 hover:bg-white/20 text-white font-mono text-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Voucher</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          id="printable-custody-voucher"
          className="p-5 rounded border border-white/15 bg-white/[0.02] flex flex-col gap-5 text-white font-sans print:bg-white print:text-black print:border-black"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-2">
            <div>
              <div className="text-[10px] font-mono tracking-widest text-white/40 uppercase">
                CRIMINALISTICS DIVISION • CRIME SCENE UNIT
              </div>
              <div className="text-base font-bold tracking-tight text-white mt-0.5">
                FIELD OPTICAL REAGENT ASSAY RECORD
              </div>
              <div className="text-xs text-white/60">
                Presumptive field test — confirmatory laboratory analysis required
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end font-mono text-xs">
              <span className="text-white/40 text-[10px]">RECORD IDENTIFIER</span>
              <span className="font-bold text-white tracking-wider">{record.caseRef}</span>
              <span className="text-[10px] text-white/60">{record.timestampUtc}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-white/40 uppercase">OPERATOR / OFFICER</span>
              <span className="text-white font-medium">{record.officerName}</span>
              <span className="text-[10px] text-white/60">Badge: {record.officerBadge}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-white/40 uppercase">UNIT & STATION</span>
              <span className="text-white font-medium">{record.stationUnit}</span>
              <span className="text-[10px] text-white/60">Station CSU-04</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-white/40 uppercase">EXAMINATION REASON</span>
              <span className="text-white font-medium truncate">{record.reason}</span>
              <span className="text-[10px] text-white/60">Presumptive Field Assay</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-white/40 uppercase">REAGENT DEPLOYED</span>
              <span className="text-white font-medium">{record.reagentName}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-white/40 uppercase">SUSPECTED ANALYTE</span>
              <span className="text-white font-medium">{record.suspectedDrug}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-white/40 uppercase">GPS STAMP (COORDINATES)</span>
              <span className="text-white/80 text-[10px] truncate">{record.gpsCoords}</span>
            </div>
          </div>

          <div className="p-4 rounded border border-white/15 bg-white/5 flex flex-col gap-3 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50 uppercase tracking-wide">
                ANALYTICAL EVALUATION RESULT
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold ${
                  record.status === 'positive'
                    ? 'bg-white text-black'
                    : 'border border-white/30 text-white'
                }`}
              >
                {record.status === 'positive'
                  ? '● PRESUMPTIVE POSITIVE'
                  : '○ NEGATIVE / INCONCLUSIVE'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-white/10 pt-2.5">
              <div>
                <span className="text-[10px] text-white/40">IDENTIFIED SUBSTANCE</span>
                <div className="text-sm font-semibold text-white font-sans">
                  {record.identifiedSubstance}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-white/40">CERTAINTY INDEX</span>
                <div className="text-sm font-bold text-white">{record.certainty}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-white/70 border-t border-white/5 pt-2">
              <div>
                <span className="text-white/40">Color Transition: </span>
                <span>{record.colorShift}</span>
              </div>
              {record.wavelengthPeakNm > 0 && (
                <div>
                  <span className="text-white/40">Peak absorbance: </span>
                  <span>{record.wavelengthPeakNm} nm</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 font-mono text-[10px] p-3 rounded border border-white/10 bg-black/40">
            <div className="flex items-center justify-between text-white/50">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-white/70" />
                <span>RECORD HASH (SHA-256)</span>
              </span>
              <span className="text-white font-semibold">COVERS METADATA + PHOTO BYTES</span>
            </div>
            <div className="text-white/70 break-all select-all font-mono text-[9px] bg-white/5 p-1.5 rounded">
              {record.sha256Hash}
            </div>
            <div className="flex items-center justify-between text-white/40 text-[9px] gap-3">
              <span className="truncate">CHAINED TO {record.previousHash.slice(0, 16)}…</span>
              <span>SEQUENCE {record.sequence || '—'}</span>
            </div>
          </div>

          <div className="flex items-end justify-between border-t border-white/10 pt-3">
            <div className="flex flex-col gap-1">
              <div className="h-8 w-44 bg-white/80 flex items-center justify-center font-mono text-[8px] text-black tracking-[0.3em] font-bold">
                |||| | |||||| || |||| ||||| |||
              </div>
              <span className="font-mono text-[9px] text-white/40">
                {record.caseRef}
              </span>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="font-mono text-xs text-white border-b border-white/40 pb-0.5 px-6 italic">
                {record.officerName}
                {record.officerBadge ? `, ${record.officerBadge}` : ''}
              </div>
              <span className="font-mono text-[9px] text-white/40">
                ELECTRONIC SIGNATURE OF VERIFYING TECHNICIAN
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 font-mono text-xs border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-white/20 bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            CLOSE
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded bg-white text-black font-semibold hover:bg-white/90 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PRINT REPORT</span>
          </button>
        </div>
      </div>
    </div>
  );
};
