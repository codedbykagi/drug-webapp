import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ScreenView, CalibrationData, ReagentProfile, TestRecord, ToastMessage } from './types';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { Toast } from './components/Toast';
import { AssistantPanel } from './components/AssistantPanel';
import { FieldTestScreen } from './components/screens/FieldTestScreen';
import { ReagentsRegistryScreen } from './components/screens/ReagentsRegistryScreen';
import { HowToUseScreen } from './components/screens/HowToUseScreen';
import { CalibrationModal } from './components/modals/CalibrationModal';
import { CustodyReportModal } from './components/modals/CustodyReportModal';
import { AddReagentModal } from './components/modals/AddReagentModal';
import { ImportDataModal } from './components/modals/ImportDataModal';
import { attachPreview } from './lib/shots';
import { requestDurableStorage, store, usingRemoteStore } from './lib/db';

const CALIBRATION_KEY = 'calibration';

const NO_CALIBRATION: CalibrationData = {
  calibrated: false,
  scorePercent: 0,
  colorTempK: 0,
  luxIlluminance: 0,
  deltaETolerance: 10,
  lastCalibratedUtc: '',
  macroLockAligned: false,
  profile: null,
};

export default function App() {
  const [currentView, setCurrentView] = useState<ScreenView>('intake');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [reagents, setReagents] = useState<ReagentProfile[]>([]);
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [calibration, setCalibration] = useState<CalibrationData>(NO_CALIBRATION);
  const [loaded, setLoaded] = useState(false);

  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isAddReagentOpen, setIsAddReagentOpen] = useState(false);
  const [isImportDataOpen, setIsImportDataOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [activeReportRecord, setActiveReportRecord] = useState<TestRecord | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((title: string, message: string, icon?: string) => {
    const next: ToastMessage = { id: crypto.randomUUID(), title, message, icon };
    setToast(next);
    setTimeout(() => setToast((prev) => (prev?.id === next.id ? null : prev)), 3200);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [storedReagents, storedRecords, storedCalibration] = await Promise.all([
          store.listReagents(),
          store.listRecords(),
          store.getSetting<CalibrationData>(CALIBRATION_KEY),
        ]);
        if (cancelled) return;
        setReagents(storedReagents);
        setRecords(storedRecords);
        if (storedCalibration) setCalibration(storedCalibration);
      } catch (err) {
        if (!cancelled) {
          showToast(
            'Storage unavailable',
            err instanceof Error ? err.message : 'Records cannot be saved in this browser.',
            'alert'
          );
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
      // Without this the browser treats our data as evictable cache.
      void requestDurableStorage();
    })();

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // Blobs come back from IndexedDB without preview URLs, so the case log builds
  // its own per thumbnail. Records handed to the report modal keep theirs.
  const hydrate = (list: TestRecord[]) =>
    list.map((r) => ({ ...r, shots: r.shots.map((s) => ({ ...s })) }));

  const handleSaveRecord = async (record: TestRecord) => {
    await store.saveRecord(record);
    setRecords((prev) => [record, ...prev]);
  };

  const handleDeleteRecord = async (id: string) => {
    await store.deleteRecord(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
    showToast('Record deleted', 'Hash chain after this point no longer verifies', 'alert');
  };

  const handleSaveCalibration = async (updated: CalibrationData) => {
    setCalibration(updated);
    await store.setSetting(CALIBRATION_KEY, updated);
  };

  const handleAddReagent = async (reagent: ReagentProfile) => {
    const next = [reagent, ...reagents];
    setReagents(next);
    await store.saveReagents([reagent]);
  };

  const handleImportReagents = async (imported: ReagentProfile[], mode: 'replace' | 'append') => {
    if (mode === 'replace') await store.clearReagents();
    const next = mode === 'replace' ? imported : [...reagents, ...imported];
    setReagents(next);
    await store.saveReagents(imported);
  };

  const handleClearRegistry = async () => {
    await store.clearReagents();
    setReagents([]);
    showToast('Registry cleared', 'No reference colours are loaded', 'tune');
  };

  const handleExportRegistry = () => {
    const blob = new Blob([JSON.stringify(reagents, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `drugtrace-registry-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Registry exported', `${reagents.length} reagents written to file`, 'file');
  };

  const handleTriggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const [freshReagents, freshRecords] = await Promise.all([
        store.listReagents(),
        store.listRecords(),
      ]);
      setReagents(freshReagents);
      setRecords(hydrate(freshRecords));
      showToast(
        'Reloaded',
        usingRemoteStore
          ? `${freshRecords.length} records from the server`
          : `${freshRecords.length} records from this device`,
        'sync'
      );
    } catch (err) {
      showToast('Sync failed', err instanceof Error ? err.message : 'Could not reach storage', 'alert');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div
      id="app-root"
      className="min-h-screen bg-black text-white font-sans antialiased selection:bg-white selection:text-black"
      style={{
        background:
          'radial-gradient(1200px at 15% 10%, rgba(255, 255, 255, 0.04) 0%, transparent 60%), radial-gradient(900px at 85% 60%, rgba(255, 255, 255, 0.03) 0%, transparent 60%), rgb(0, 0, 0)',
      }}
    >
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        reagentCount={reagents.length}
      />

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <TopHeader
          calibration={calibration}
          onOpenCalibrate={() => setIsCalibrationOpen(true)}
          onTriggerSync={() => void handleTriggerSync()}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isSyncing={isSyncing}
        />

        <main className="pt-20 px-4 sm:px-6 pb-16 flex-1">
          {!loaded ? (
            <div className="max-w-6xl mx-auto py-24 text-center font-mono text-xs text-white/40">
              Opening local store…
            </div>
          ) : (
            <>
              {currentView === 'intake' && (
                <FieldTestScreen
                  reagents={reagents}
                  records={records}
                  profile={calibration.profile}
                  onSaveRecord={handleSaveRecord}
                  onDeleteRecord={handleDeleteRecord}
                  onOpenReport={setActiveReportRecord}
                  onOpenCalibration={() => setIsCalibrationOpen(true)}
                  onTriggerToast={showToast}
                />
              )}

              {currentView === 'registry' && (
                <ReagentsRegistryScreen
                  reagents={reagents}
                  onOpenAddModal={() => setIsAddReagentOpen(true)}
                  onOpenImportModal={() => setIsImportDataOpen(true)}
                  onClearRegistry={() => void handleClearRegistry()}
                  onExportRegistry={handleExportRegistry}
                  onTriggerToast={showToast}
                />
              )}

              {currentView === 'ops' && (
                <HowToUseScreen
                  onNavigateToIntake={() => setCurrentView('intake')}
                  onOpenCalibration={() => setIsCalibrationOpen(true)}
                  onTriggerToast={showToast}
                />
              )}
            </>
          )}
        </main>
      </div>

      <CalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        calibration={calibration}
        onSaveCalibration={(c) => void handleSaveCalibration(c)}
        onTriggerToast={showToast}
      />

      {activeReportRecord && (
        <CustodyReportModal
          isOpen
          onClose={() => setActiveReportRecord(null)}
          record={activeReportRecord}
          onTriggerToast={showToast}
        />
      )}

      <AddReagentModal
        isOpen={isAddReagentOpen}
        onClose={() => setIsAddReagentOpen(false)}
        onAddReagent={(r) => void handleAddReagent(r)}
        onTriggerToast={showToast}
      />

      <ImportDataModal
        isOpen={isImportDataOpen}
        onClose={() => setIsImportDataOpen(false)}
        existingCount={reagents.length}
        onImportReagents={(list, mode) => void handleImportReagents(list, mode)}
        onTriggerToast={showToast}
      />

      <AssistantPanel
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        reagents={reagents}
      />

      {/* The sidebar is hidden below lg, so the assistant needs its own way in. */}
      {!isAssistantOpen && (
        <button
          type="button"
          onClick={() => setIsAssistantOpen(true)}
          aria-label="Open reagent assistant"
          className="lg:hidden fixed bottom-6 left-6 z-40 w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
        >
          <Sparkles className="w-5 h-5" />
        </button>
      )}

      <Toast toast={toast} />
    </div>
  );
}
