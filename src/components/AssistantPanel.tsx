import React, { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, MessageSquare, Sparkles, X } from 'lucide-react';
import { Answer, ask, starters } from '../lib/assistant';
import type { ReagentProfile } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reagents: ReagentProfile[];
}

interface Turn {
  id: string;
  question: string;
  answer: Answer;
}

export const AssistantPanel: React.FC<Props> = ({ isOpen, onClose, reagents }) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Lookup is synchronous and takes under a millisecond, so there is no
  // pending state to manage and nothing to wait for.
  const submit = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setTurns((prev) => [...prev, { id: crypto.randomUUID(), question: trimmed, answer: ask(trimmed, reagents) }]);
    setDraft('');
  };

  if (!isOpen) return null;

  const suggestions = starters(reagents);

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        aria-hidden
      />

      <aside
        role="dialog"
        aria-label="Reagent assistant"
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[26rem] z-50 flex flex-col border-l border-white/15"
        style={{
          background: 'linear-gradient(rgba(20, 20, 24, 0.96) 0%, rgba(10, 10, 12, 0.98) 100%)',
          backdropFilter: 'blur(32px) saturate(190%)',
          boxShadow: 'rgba(255, 255, 255, 0.18) 1px 0px 0px 0px inset, rgba(0, 0, 0, 0.8) -20px 0 40px -10px',
        }}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded border border-white/25 bg-white/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex flex-col font-mono">
              <span className="text-xs font-semibold text-white tracking-wide uppercase">
                Reagent assistant
              </span>
              <span className="text-[10px] text-white/45">
                {reagents.length
                  ? `Offline · ${reagents.length} reagent${reagents.length === 1 ? '' : 's'} loaded`
                  : 'Offline · registry empty'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            aria-label="Close assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {!turns.length && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-white/55 leading-relaxed">
                Answers come only from the reagent registry on this device. Nothing is sent
                anywhere, and it will say so rather than guess when something is not loaded.
              </p>
              {suggestions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="text-left text-[11px] px-3 py-2 rounded border border-white/12 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/25 text-white/70 hover:text-white transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {turns.map((turn) => (
            <div key={turn.id} className="flex flex-col gap-2.5">
              <div className="self-end max-w-[85%] px-3 py-2 rounded-lg bg-white text-black text-xs font-medium">
                {turn.question}
              </div>

              <div className="flex flex-col gap-2.5">
                <p className="text-xs text-white/80 leading-relaxed">{turn.answer.summary}</p>

                {turn.answer.rows.length > 0 && (
                  <div className="flex flex-col divide-y divide-white/5 border border-white/10 rounded-lg overflow-hidden">
                    {turn.answer.rows.map((r, i) => (
                      <div key={`${r.reagent}-${r.analyte}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                        {r.hex ? (
                          <span
                            className="w-5 h-5 rounded border border-white/25 shrink-0"
                            style={{ background: r.hex }}
                            title={r.hex}
                          />
                        ) : (
                          <span className="w-5 h-5 rounded border border-dashed border-white/20 shrink-0" />
                        )}
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-[11px] text-white font-medium truncate">{r.analyte}</span>
                          <span className="text-[10px] text-white/45 font-mono truncate">
                            {r.reagent} · {r.colourLabel}
                          </span>
                        </div>
                        {r.detail && (
                          <span className="text-[10px] text-white/40 font-mono shrink-0">{r.detail}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {turn.answer.sources.length > 0 && (
                  <span className="text-[10px] text-white/30 font-mono">
                    from registry: {[...new Set(turn.answer.sources)].join(', ')}
                  </span>
                )}

                {turn.answer.followups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {turn.answer.followups.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => submit(f)}
                        className="text-[10px] px-2 py-1 rounded border border-white/12 bg-white/[0.03] hover:bg-white/10 text-white/60 hover:text-white transition-all"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-white/10 shrink-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 glass-input rounded-md px-3 py-2">
            <MessageSquare className="w-3.5 h-3.5 text-white/35 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit(draft);
              }}
              placeholder="Ask about a reagent, substance or colour"
              className="bg-transparent border-none text-white placeholder-white/30 w-full focus:outline-none text-xs"
            />
            <button
              type="button"
              onClick={() => submit(draft)}
              disabled={!draft.trim()}
              className="text-white/40 hover:text-white disabled:opacity-30 transition-colors shrink-0"
              aria-label="Ask"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </div>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => setTurns([])}
              className="self-start text-[10px] font-mono text-white/35 hover:text-white/70 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
