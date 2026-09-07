import React from 'react';
import { ToastMessage } from '../types';
import { Check, Lock, Camera, Upload, Sliders, RefreshCw, AlertCircle, Printer, FileText } from 'lucide-react';

interface ToastProps {
  toast: ToastMessage | null;
}

export const Toast: React.FC<ToastProps> = ({ toast }) => {
  if (!toast) return null;

  const renderIcon = (iconName?: string) => {
    switch (iconName) {
      case 'lock':
        return <Lock className="w-4 h-4 text-white" />;
      case 'photo_camera':
        return <Camera className="w-4 h-4 text-white" />;
      case 'upload_file':
      case 'upload':
        return <Upload className="w-4 h-4 text-white" />;
      case 'tune':
        return <Sliders className="w-4 h-4 text-white" />;
      case 'sync':
        return <RefreshCw className="w-4 h-4 text-white" />;
      case 'print':
        return <Printer className="w-4 h-4 text-white" />;
      case 'file':
        return <FileText className="w-4 h-4 text-white" />;
      default:
        return <Check className="w-4 h-4 text-white" />;
    }
  };

  return (
    <div
      id="toast-notification"
      className="fixed bottom-6 right-6 z-50 glass-panel-elevated bg-black/95 rounded-lg p-3 px-4 flex items-center gap-3 shadow-2xl border border-white/25 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
      role="status"
    >
      <div className="w-6 h-6 rounded border border-white/20 bg-white/10 flex items-center justify-center shrink-0">
        {renderIcon(toast.icon)}
      </div>
      <div className="flex flex-col font-mono">
        <span className="text-xs text-white font-semibold uppercase tracking-wider">
          {toast.title}
        </span>
        <span className="text-[10px] text-white/60 tracking-tight">
          {toast.message}
        </span>
      </div>
    </div>
  );
};
