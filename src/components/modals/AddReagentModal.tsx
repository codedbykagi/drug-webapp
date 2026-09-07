import React, { useState } from 'react';
import { X, Plus, FlaskConical, Check } from 'lucide-react';
import { ReagentProfile } from '../../types';

interface AddReagentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddReagent: (reagent: ReagentProfile) => void;
  onTriggerToast: (title: string, msg: string, icon?: string) => void;
}

export const AddReagentModal: React.FC<AddReagentModalProps> = ({
  isOpen,
  onClose,
  onAddReagent,
  onTriggerToast,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [chemicalMatrix, setChemicalMatrix] = useState('');
  const [targetAnalytes, setTargetAnalytes] = useState('');
  const [reactionColor, setReactionColor] = useState('');
  const [hexColor, setHexColor] = useState('#221838');
  const [absorbancePeak, setAbsorbancePeak] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [tempLimit, setTempLimit] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const analytesList = targetAnalytes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const newReagent: ReagentProfile = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      chemicalMatrix: chemicalMatrix.trim(),
      targetAnalytes: analytesList.length > 0 ? analytesList : ['Unspecified'],
      reactionColor: reactionColor.trim(),
      hexColor,
      absorbancePeakNm: Number(absorbancePeak) || 0,
      slotNumber: '',
      lotNumber: lotNumber.trim() || '—',
      expirationDate: expirationDate || '—',
      tempLimitC: tempLimit.trim() || '—',
      colorStates: [
        {
          label: reactionColor.trim() || 'Positive reaction',
          hex: hexColor,
          analyte: analytesList[0] ?? name.trim(),
        },
      ],
      blankHex: null,
      status: 'active',
      description: description.trim(),
      colourStateCount: 1,
      source: 'manual',
      addedAt: new Date().toISOString(),
    };

    onAddReagent(newReagent);
    onTriggerToast('Reagent added', `${newReagent.name} saved to the registry`, 'tune');
    onClose();
  };

  return (
    <div
      id="modal-add-reagent"
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
              <FlaskConical className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white tracking-wide uppercase">
                Add reagent
              </span>
              <span className="text-[10px] text-white/50">
                Only the name and colour are needed for matching
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs font-sans">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-white/70 font-medium">Reagent name</label>
              <input
                required
                type="text"
                placeholder="e.g. Liebermann Reagent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="glass-input rounded-md px-3 py-2 text-white placeholder-white/30 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/70 font-medium">Composition</label>
              <input
                type="text"
                placeholder="e.g. Potassium Nitrite in H2SO4"
                value={chemicalMatrix}
                onChange={(e) => setChemicalMatrix(e.target.value)}
                className="glass-input rounded-md px-3 py-2 text-white placeholder-white/30 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-white/70 font-medium">Substances it detects (comma separated)</label>
            <input
              type="text"
              placeholder="e.g. Methamphetamine, Amphetamine, MDMA"
              value={targetAnalytes}
              onChange={(e) => setTargetAnalytes(e.target.value)}
              className="glass-input rounded-md px-3 py-2 text-white placeholder-white/30 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-white/70 font-medium">Colour it turns</label>
              <input
                type="text"
                placeholder="e.g. Violet to Black"
                value={reactionColor}
                onChange={(e) => setReactionColor(e.target.value)}
                className="glass-input rounded-md px-3 py-2 text-white placeholder-white/30 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/70 font-medium">Peak absorbance (nm)</label>
              <input
                type="number"
                placeholder="Optional"
                value={absorbancePeak}
                onChange={(e) => setAbsorbancePeak(e.target.value)}
                className="glass-input rounded-md px-3 py-2 text-white placeholder-white/30 text-xs font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-white/70 font-medium">Reference colour</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={hexColor}
                  onChange={(e) => setHexColor(e.target.value)}
                  className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer p-0"
                />
                <span className="font-mono text-white/60 text-xs">{hexColor}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
            <div className="flex flex-col gap-1.5">
              <label className="text-white/70 text-[11px]">LOT NUMBER</label>
              <input
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                className="glass-input rounded-md px-3 py-2 text-white placeholder-white/30 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-white/70 text-[11px]">EXPIRY DATE</label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="glass-input rounded-md px-3 py-2 text-white placeholder-white/30 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-white/70 text-[11px]">STORAGE TEMPERATURE</label>
              <input
                type="text"
                value={tempLimit}
                onChange={(e) => setTempLimit(e.target.value)}
                className="glass-input rounded-md px-3 py-2 text-white placeholder-white/30 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-white/70 font-medium">Notes</label>
            <textarea
              rows={2}
              placeholder="Read time, safety notes, anything that affects how the result is read"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="glass-input rounded-md px-3 py-2 text-white placeholder-white/30 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4 font-mono text-xs">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-white text-black font-semibold hover:bg-white/90 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add reagent</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
