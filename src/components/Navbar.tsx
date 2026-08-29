import React, { useState, useEffect } from 'react';
import { ShieldCheck, Factory, Smartphone, LayoutDashboard, Clock, MapPin, UserCheck, Activity } from 'lucide-react';
import { ShiftName } from '../types';
import { getCurrentShift, formatTimestamp } from '../utils/geolocation';

interface NavbarProps {
  currentView: 'dashboard' | 'operator' | 'admin';
  onViewChange: (view: 'dashboard' | 'operator' | 'admin') => void;
  selectedMinifactoryId: string;
  onMinifactoryChange: (id: string) => void;
  minifactories: Array<{ id: string; name: string }>;
  gpsStatus: { latitude: number; longitude: number; isWithinGeofence: boolean };
  backendStatus?: 'connected' | 'disconnected' | 'checking';
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  selectedMinifactoryId,
  onMinifactoryChange,
  minifactories,
  gpsStatus,
  backendStatus = 'checking',
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [currentShift, setCurrentShift] = useState<ShiftName>(getCurrentShift());

  useEffect(() => {
    const update = () => {
      setTimeStr(formatTimestamp(new Date()));
      setCurrentShift(getCurrentShift());
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 border-b border-slate-200 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Brand & Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm font-bold shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-sm sm:text-lg tracking-tight leading-tight">
                TPM Smart Verify
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 hidden sm:block">
                Digital Shopfloor Verification
              </p>
            </div>
          </div>

          {/* Minifactory Picker Pills */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {minifactories.map((mf) => {
              const shortLabel = mf.id; // 'MF1', 'MF2', 'MF3'
              const isSelected = selectedMinifactoryId === mf.id;
              return (
                <button
                  key={mf.id}
                  onClick={() => onMinifactoryChange(mf.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Factory className="w-3.5 h-3.5 text-sky-600" />
                  <span>{shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Live Shift & Clock + Backend Status */}
          <div className="hidden md:flex items-center gap-3 text-xs border-l border-r border-slate-200 px-3 py-1">
            <div className="flex items-center gap-1.5 text-amber-800 font-mono bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>{currentShift.split(' ')[0]} ({currentShift.split('(')[1].replace(')', '')})</span>
            </div>
            <div className="text-slate-700 font-mono text-[11px] hidden xl:block">
              {timeStr.slice(11)}
            </div>
            <div className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${
              gpsStatus.isWithinGeofence
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="font-mono">GPS Locked</span>
            </div>
            {/* MinIO / Backend connection indicator */}
            <div className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${
              backendStatus === 'connected'
                ? 'bg-violet-50 border-violet-200 text-violet-700'
                : backendStatus === 'checking'
                ? 'bg-slate-50 border-slate-200 text-slate-500'
                : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}>
              <Activity className="w-3 h-3 shrink-0" />
              <span className="font-mono">
                {backendStatus === 'connected' ? 'API ✓' : backendStatus === 'checking' ? 'API...' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Controls: Mode Navigation Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => onViewChange('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  currentView === 'dashboard'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600" />
                <span className="hidden sm:inline">Plant Dashboard</span>
                <span className="sm:hidden">Dashboard</span>
              </button>

              <button
                onClick={() => onViewChange('operator')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  currentView === 'operator'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold hover:bg-amber-400'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Fill Checklist</span>
              </button>

              <button
                onClick={() => onViewChange('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  currentView === 'admin'
                    ? 'bg-violet-500 text-white shadow-sm font-bold hover:bg-violet-400'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Coordinator Portal</span>
                <span className="sm:hidden">Admin</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
