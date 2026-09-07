import React, { useRef, useState } from 'react';
import { AlertCircle, Check, Copy, FileText, Upload, X } from 'lucide-react';
import {
  ImportIssue,
  REGISTRY_TEMPLATE,
  parseRegistryCsv,
  parseRegistryJson,
} from '../../lib/reagents';
import type { ReagentProfile } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  existingCount: number;
  onImportReagents: (reagents: ReagentProfile[], mode: 'replace' | 'append') => void;
  onTriggerToast: (title: string, msg: string, icon?: string) => void;
}

export const ImportDataModal: React.FC<Props> = ({
  isOpen,
  onClose,
  existingCount,
  onImportReagents,
  onTriggerToast,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawText, setRawText] = useState('');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  if (!isOpen) return null;

  const readFile = async (file: File) => {
    setFileName(file.name);
    setFormat(file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json');
    setRawText(await file.text());
    setError(null);
    setIssues([]);
  };

  const commit = () => {
    const text = rawText.trim();
    if (!text) {
      setError('Paste the registry, or choose a file.');
      return;
    }

    try {
      const result = format === 'json' ? parseRegistryJson(text) : parseRegistryCsv(text);
      if (!result.reagents.length) {
        setError('Nothing usable in that file — every entry was missing a name.');
        setIssues(result.issues);
        return;
      }

      setIssues(result.issues);
      onImportReagents(result.reagents, mode);

      const skipped = result.issues.length;
      onTriggerToast(
        'Registry imported',
        `${result.reagents.length} reagents loaded${skipped ? `, ${skipped} warnings` : ''}`,
        'upload'
      );

      if (!skipped) {
        setRawText('');
        setFileName(null);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
      setIssues([]);
    }
  };

  return (
    <div
      id="modal-import-data"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
    >
      <div
        className="w-full max-w-xl glass-panel-elevated bg-black/95 rounded-lg border border-white/20 p-6 flex flex-col gap-5 shadow-2xl relative my-8"
        style={{
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.9), inset 0 1px 0 0 rgba(255, 255, 255, 0.25)',
        }}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3 font-mono">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded border border-white/30 bg-white/10 flex items-center justify-center">
              <Upload className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white tracking-wide uppercase">
                Import reagent data
              </span>
              <span className="text-[10px] text-white/50">JSON or CSV</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded border border-dashed border-white/25 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/40 text-white transition-all font-mono text-[11px]"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{fileName ?? 'Choose a .json or .csv file'}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void readFile(file);
            }}
            className="hidden"
          />
        </div>

        <div className="flex flex-col gap-2 font-mono text-xs">
          <div className="flex items-center justify-between text-[11px] gap-2">
            <span className="text-white/60">Or paste it here</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRawText(REGISTRY_TEMPLATE);
                  setFormat('json');
                  setFileName(null);
                  setError(null);
                }}
                className="flex items-center gap-1 text-white/50 hover:text-white transition-colors text-[10px]"
                title="Load the expected shape so your teammate knows what to produce"
              >
                <Copy className="w-3 h-3" />
                <span>Show expected format</span>
              </button>
              <div className="inline-flex border border-white/20 rounded p-0.5 bg-black">
                {(['json', 'csv'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                      format === f ? 'bg-white text-black font-semibold' : 'text-white/60'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <textarea
            rows={7}
            spellCheck={false}
            placeholder={
              format === 'json'
                ? 'Paste an array of reagent objects, or {"reagents": [...]}'
                : 'name,chemicalMatrix,targetAnalytes,reactionColor,hexColor,absorbancePeakNm'
            }
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setError(null);
            }}
            className="glass-input rounded font-mono text-[11px] p-3 text-white placeholder-white/30 w-full resize-y"
          />
        </div>

        {existingCount > 0 && (
          <div className="flex items-center justify-between font-mono text-[11px] gap-3">
            <span className="text-white/60">
              {existingCount} reagent{existingCount === 1 ? '' : 's'} already loaded
            </span>
            <div className="inline-flex border border-white/20 rounded p-0.5 bg-black shrink-0">
              {(['replace', 'append'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-2 py-0.5 rounded text-[10px] capitalize ${
                    mode === m ? 'bg-white text-black font-semibold' : 'text-white/60'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-white/80 bg-white/5 border border-white/20 p-3 rounded flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {issues.length > 0 && (
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto font-mono text-[10px] text-white/60 border border-white/10 rounded p-2.5">
            <span className="text-white/40 uppercase tracking-wider">
              {issues.length} entr{issues.length === 1 ? 'y' : 'ies'} needed attention
            </span>
            {issues.map((issue, i) => (
              <span key={`${issue.row}-${issue.field}-${i}`}>
                row {issue.row} · {issue.field} — {issue.message}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-3 font-mono text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={commit}
            className="flex items-center gap-1.5 px-4 py-2 rounded bg-white text-black font-semibold hover:bg-white/90 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>
        </div>
      </div>
    </div>
  );
};
