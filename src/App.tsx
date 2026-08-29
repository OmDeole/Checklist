import React, { useState, useEffect, useCallback } from 'react';
import { Minifactory, Station } from './types';
import { INITIAL_MINIFACTORIES } from './data/initialData';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { OperatorChecklist } from './components/OperatorChecklist';
import { CoordinatorAdmin } from './components/CoordinatorAdmin';
import { requestCurrentLocation } from './utils/geolocation';
import { ShieldCheck, CheckCircle2, AlertTriangle, X, Smartphone, Wifi, Battery, Signal, Radio } from 'lucide-react';

const BACKEND_URL = 'http://localhost:3001';

export default function App() {
  // Load initial minifactories from localStorage or default
  const [minifactories, setMinifactories] = useState<Minifactory[]>(() => {
    try {
      const saved = localStorage.getItem('tpm_minifactories_data_v4');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse cached minifactories:', e);
    }
    return INITIAL_MINIFACTORIES;
  });

  const [currentView, setCurrentView] = useState<'dashboard' | 'operator' | 'admin'>('operator');
  const [selectedMinifactoryId, setSelectedMinifactoryId] = useState<string>('MF2'); // Default to MF2 as requested
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  const [gpsStatus, setGpsStatus] = useState({
    latitude: 18.52043,
    longitude: 73.85674,
    isWithinGeofence: true,
  });

  const [toastMessage, setToastMessage] = useState<{
    title: string;
    description: string;
    type: 'success' | 'alert';
  } | null>(null);

  // Save minifactories to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('tpm_minifactories_data_v4', JSON.stringify(minifactories));
    } catch (e) {
      console.warn('Failed to save minifactories to localStorage:', e);
    }
  }, [minifactories]);

  // Request GPS position on load
  useEffect(() => {
    requestCurrentLocation().then((coords) => {
      setGpsStatus({
        latitude: coords.latitude,
        longitude: coords.longitude,
        isWithinGeofence: coords.isWithinGeofence,
      });
    });
  }, []);

  // ─── Backend Health Check ────────────────────────────────────────
  const checkBackendHealth = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('disconnected');
      }
    } catch {
      setBackendStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    checkBackendHealth();
    // Re-check every 30 seconds
    const interval = setInterval(checkBackendHealth, 30000);
    return () => clearInterval(interval);
  }, [checkBackendHealth]);

  // ─── Backend Sync on Submission ──────────────────────────────────
  const syncSubmissionToBackend = async (submission: any) => {
    if (backendStatus !== 'connected') return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/checklists/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });

      if (res.ok) {
        const result = await res.json();
        console.log(`✓ Synced to backend: ${result.submissionId} (${result.photosUploaded} photos uploaded)`);
      }
    } catch (err) {
      console.warn('Backend sync failed (will retry later):', err);
    }
  };

  // Update a station when an operator submits a checklist
  const handleStationSubmitSuccess = (updatedStation: Station, submissionHash: string) => {
    setMinifactories((prev) =>
      prev.map((mf) => {
        if (mf.id === updatedStation.minifactoryId) {
          return {
            ...mf,
            lines: mf.lines.map((l) => {
              if (l.id === updatedStation.lineId) {
                return {
                  ...l,
                  stations: l.stations.map((st) => (st.id === updatedStation.id ? updatedStation : st)),
                };
              }
              return l;
            }),
          };
        }
        return mf;
      })
    );

    // Sync submission to backend (non-blocking)
    const submissionPayload = {
      minifactoryId: updatedStation.minifactoryId,
      lineId: updatedStation.lineId,
      stationId: updatedStation.id,
      stationNumber: updatedStation.number,
      lineName: updatedStation.lineName,
      operatorName: updatedStation.operatorName || '',
      operatorId: updatedStation.operatorId || '',
      shift: updatedStation.shift,
      completedAt: updatedStation.lastSubmittedAt || new Date().toISOString(),
      timeTakenSeconds: 0,
      location: gpsStatus,
      machineCheckpoints: updatedStation.machineCheckpoints,
      pokayokeCheckpoints: updatedStation.pokayokeCheckpoints,
      deviations: updatedStation.deviations,
      overallStatus: updatedStation.status === 'DEVIATION_STOPPED' ? 'DEVIATION' : 'OK',
      verificationHash: submissionHash,
      isAuthentic: !updatedStation.isFlaggedForFalsification,
    };

    syncSubmissionToBackend(submissionPayload);

    // Show Toast
    setToastMessage({
      title: updatedStation.status === 'DEVIATION_STOPPED' ? 'Station Stopped (Deviation Logged)' : 'Checklist Verified & Submitted',
      description: `Station ${updatedStation.number} (${updatedStation.name}) recorded with cryptographic verification stamp ${submissionHash}.`,
      type: updatedStation.status === 'DEVIATION_STOPPED' ? 'alert' : 'success',
    });

    // Auto-switch to dashboard view after 2.5 seconds to see live update
    setTimeout(() => {
      setCurrentView('dashboard');
    }, 2500);
  };

  const handleNavigateToChecklist = (minifactoryId: string, lineId: string, stationId: string) => {
    setSelectedMinifactoryId(minifactoryId);
    setCurrentView('operator');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased selection:bg-sky-600 selection:text-white flex flex-col">
      {/* Navbar */}
      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        selectedMinifactoryId={selectedMinifactoryId}
        onMinifactoryChange={setSelectedMinifactoryId}
        minifactories={minifactories.map((m) => ({ id: m.id, name: m.name }))}
        gpsStatus={gpsStatus}
        backendStatus={backendStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 py-4 sm:py-6">
        {currentView === 'dashboard' ? (
          <Dashboard
            minifactories={minifactories}
            selectedMinifactoryId={selectedMinifactoryId}
            onMinifactoryChange={setSelectedMinifactoryId}
            onNavigateToChecklist={handleNavigateToChecklist}
          />
        ) : currentView === 'admin' ? (
          <CoordinatorAdmin
            minifactories={minifactories}
            selectedMinifactoryId={selectedMinifactoryId}
          />
        ) : (
          <OperatorChecklist
            minifactories={minifactories}
            selectedMinifactoryId={selectedMinifactoryId}
            onMinifactoryChange={setSelectedMinifactoryId}
            onSubmitSuccess={handleStationSubmitSuccess}
          />
        )}
      </main>

      {/* Toast Notification Popup */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-300">
          <div
            className={`p-4 rounded-2xl shadow-xl border flex items-start justify-between gap-3 backdrop-blur-md ${
              toastMessage.type === 'alert'
                ? 'bg-rose-50/95 border-rose-200 text-slate-900'
                : 'bg-emerald-50/95 border-emerald-200 text-slate-900'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  toastMessage.type === 'alert' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {toastMessage.type === 'alert' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">{toastMessage.title}</h4>
                <p className="text-xs text-slate-600 mt-1">{toastMessage.description}</p>
              </div>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
