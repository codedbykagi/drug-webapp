import React from 'react';
import { ScreenView } from '../types';
import { Crosshair, FlaskConical, BookOpen, Sparkles } from 'lucide-react';

interface SidebarProps {
  currentView: ScreenView;
  onSelectView: (view: ScreenView) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onOpenAssistant: () => void;
  reagentCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  isOpenMobile,
  onCloseMobile,
  onOpenAssistant,
  reagentCount,
}) => {
  const handleNav = (view: ScreenView) => {
    onSelectView(view);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {isOpenMobile && (
        <div
          id="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      <aside
        id="tactical-sidebar"
        className={`fixed left-0 top-0 h-full w-64 glass-panel z-50 flex flex-col justify-between p-4 border-r border-white/10 bg-black/80 transition-transform duration-300 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          background: 'linear-gradient(rgba(20, 20, 24, 0.85) 0%, rgba(10, 10, 12, 0.95) 100%)',
          backdropFilter: 'blur(32px) saturate(190%)',
          boxShadow: 'rgba(255, 255, 255, 0.12) -1px 0px 0px 0px inset, rgba(255, 255, 255, 0.18) 0px 1px 0px 0px inset',
        }}
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 px-1 pt-1">
            <div className="w-8 h-8 rounded border border-white/40 flex items-center justify-center bg-white/5">
              <Crosshair className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs tracking-[0.24em] text-white font-semibold leading-none uppercase">
                DRUGTRACEAI
              </span>
              <span className="font-mono text-[9px] tracking-widest text-white/50 uppercase mt-1">
                FIELD TEST RECORDS
              </span>
            </div>
          </div>

          <nav className="flex flex-col gap-1" id="sidebar-nav">
            <button
              id="nav-field-test"
              onClick={() => handleNav('intake')}
              className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-wide text-left transition-all ${
                currentView === 'intake'
                  ? 'border border-white/20 bg-white/10 text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 shrink-0" />
              <span>Field Test & Intake</span>
            </button>

            <button
              id="nav-reagents-registry"
              onClick={() => handleNav('registry')}
              className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-wide text-left transition-all ${
                currentView === 'registry'
                  ? 'border border-white/20 bg-white/10 text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5 shrink-0" />
              <span>Reagents & Registry</span>
            </button>

            <button
              id="nav-how-to-use"
              onClick={() => handleNav('ops')}
              className={`flex items-center gap-3 px-3 py-2 rounded text-xs tracking-wide text-left transition-all ${
                currentView === 'ops'
                  ? 'border border-white/20 bg-white/10 text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>How to Use</span>
            </button>

            <button
              id="nav-assistant"
              onClick={() => {
                onOpenAssistant();
                if (onCloseMobile) onCloseMobile();
              }}
              className="flex items-center gap-3 px-3 py-2 mt-2 rounded text-xs tracking-wide text-left transition-all text-white/60 hover:text-white hover:bg-white/5 border border-white/10 border-dashed"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">Ask the registry</span>
              <span className="font-mono text-[9px] text-white/35">{reagentCount || '—'}</span>
            </button>
          </nav>
        </div>

        <div className="flex flex-col gap-3">
          <div className="glass-panel rounded p-3 flex flex-col gap-1.5 text-[10px]">
            <div className="flex items-center justify-between text-white/50">
              <span>SYSTEM_STATE</span>
              <span className="inline-flex items-center gap-1.5 text-white font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                LOCAL
              </span>
            </div>
            <div className="text-white/40 truncate text-[9px]">STORAGE: ON-DEVICE (INDEXEDDB)</div>
            <div className="text-white/30 truncate text-[8.5px]">INTEGRITY: SHA-256 HASH CHAIN</div>
          </div>

          <div className="flex items-center gap-3 p-2.5 glass-panel rounded">
            <div className="w-8 h-8 rounded border border-white/30 bg-white/10 flex items-center justify-center shrink-0">
              <Crosshair className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-white font-medium tracking-tight truncate">
                DrugTrace
              </span>
              <span className="text-[10px] text-white/40 tracking-wider truncate">
                Officer details are per record
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
