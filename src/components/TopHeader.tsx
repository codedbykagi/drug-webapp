import React, { useState, useEffect } from 'react';
import { Clock, Sliders, RefreshCw, Menu, Radio } from 'lucide-react';
import { CalibrationData } from '../types';

interface TopHeaderProps {
  calibration: CalibrationData;
  onOpenCalibrate: () => void;
  onTriggerSync: () => void;
  onToggleMobileMenu: () => void;
  isSyncing: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  calibration,
  onOpenCalibrate,
  onTriggerSync,
  onToggleMobileMenu,
  isSyncing,
}) => {
  const [utcTime, setUtcTime] = useState<string>('14:02:49');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${hours}:${minutes}:${seconds}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      id="top-system-header"
      className="fixed top-0 left-0 lg:left-64 right-0 h-14 z-40 px-4 lg:px-6 flex items-center justify-between border-b border-white/10"
      style={{
        background: 'linear-gradient(rgba(25, 25, 28, 0.85) 0%, rgba(12, 12, 14, 0.9) 100%)',
        backdropFilter: 'blur(28px) saturate(190%)',
        boxShadow:
          'rgba(255, 255, 255, 0.16) 0px 1px 0px 0px inset, rgba(0, 0, 0, 0.6) 0px 10px 30px -10px',
      }}
    >
      <div className="flex items-center gap-3 lg:gap-4 font-mono text-xs">
        <button
          id="btn-mobile-menu"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-white"
          aria-label="Toggle menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-white/70">
          <Clock className="w-3.5 h-3.5 text-white/60 shrink-0" />
          <span id="tactical-timestamp" className="tracking-wide">
            UTC {utcTime}
          </span>
        </div>

        <div className="hidden sm:block h-3 w-[1px] bg-white/20"></div>

        <div
          onClick={onOpenCalibrate}
          className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded border border-white/15 bg-white/5 text-white/80 cursor-pointer hover:bg-white/10 transition-colors"
          title="Lighting reference"
        >
          <Sliders className="w-3 h-3 text-white/60" />
          <span className="text-[11px] tracking-tight">
            {calibration.calibrated ? `Light ref ${calibration.scorePercent}%` : 'Set light ref'}
          </span>
        </div>

        <div className="hidden md:block h-3 w-[1px] bg-white/20"></div>

        <div className="hidden md:flex items-center gap-2 text-white/60 text-[11px]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${calibration.calibrated ? 'bg-white' : 'bg-white/30'}`}
          ></span>
          <span>{calibration.calibrated ? 'Reference set' : 'No reference'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-2.5 font-mono text-xs">
        <button
          id="btn-calibrate"
          type="button"
          onClick={onOpenCalibrate}
          className="flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-white transition-all text-xs"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">CALIBRATE</span>
          <span className="xs:hidden">CAL</span>
        </button>

        <button
          id="btn-sync"
          type="button"
          onClick={onTriggerSync}
          disabled={isSyncing}
          className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-white transition-all text-xs ${
            isSyncing ? 'opacity-70 cursor-wait' : ''
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'SYNCING...' : 'SYNC'}</span>
        </button>
      </div>
    </header>
  );
};
