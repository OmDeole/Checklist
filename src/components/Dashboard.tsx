import React, { useState } from 'react';
import {
  Factory,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Camera,
  Activity,
  Filter,
  Eye,
  FileSpreadsheet,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Minifactory, Station, DeviationLog, ShiftName } from '../types';
import { AuditDetailModal } from './AuditDetailModal';
import { getCurrentShift } from '../utils/geolocation';

interface DashboardProps {
  minifactories: Minifactory[];
  selectedMinifactoryId: string;
  onMinifactoryChange: (id: string) => void;
  onNavigateToChecklist: (minifactoryId: string, lineId: string, stationId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  minifactories,
  selectedMinifactoryId,
  onMinifactoryChange,
  onNavigateToChecklist,
}) => {
  const currentMf = minifactories.find((m) => m.id === selectedMinifactoryId) || minifactories[1] || minifactories[0];
  const lines = currentMf.lines || [];

  const [selectedLineId, setSelectedLineId] = useState<string>(lines[0]?.id || 'MF2-LINE2');
  const [selectedShift, setSelectedShift] = useState<string>('All Shifts');
  const [activeAuditStation, setActiveAuditStation] = useState<Station | null>(null);

  const currentLine = lines.find((l) => l.id === selectedLineId) || lines[0];
  const stations = currentLine?.stations || [];

  // Metrics calculation
  const totalStations = stations.length;
  const completedStations = stations.filter((s) => s.status === 'COMPLETED').length;
  const stoppedStations = stations.filter((s) => s.status === 'DEVIATION_STOPPED').length;
  const inProgressStations = stations.filter((s) => s.status === 'IN_PROGRESS' || s.status === 'PENDING').length;
  const completionPercentage = totalStations > 0 ? Math.round((completedStations / totalStations) * 100) : 0;

  // Aggregate all deviations across all minifactories for the 2nd screenshot table
  const allDeviations: DeviationLog[] = minifactories.flatMap((m) =>
    m.lines.flatMap((l) => l.stations.flatMap((s) => s.deviations || []))
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Completion */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl"></div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Shift Completion</span>
            <span className="p-2 bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {completedStations} <span className="text-sm font-normal text-slate-500">/ {totalStations} Stations</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden border border-slate-200">
            <div
              className="bg-slate-900 h-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-mono">{completionPercentage}% Verified On-Time</p>
        </div>

        {/* Stopped Stations Alert */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Deviations & Station Stops</span>
            <span className={`p-2 rounded-xl border ${
              stoppedStations > 0 ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {stoppedStations} <span className="text-sm font-normal text-slate-500">Active Stops</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
            {stoppedStations > 0 ? (
              <span className="text-rose-600 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> Station Action Required
              </span>
            ) : (
              <span className="text-emerald-600 font-semibold">All lines operating normally</span>
            )}
          </p>
        </div>

        {/* Photos Evidence Count */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Authentic Camera Evidences</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <Camera className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {stations.reduce(
              (acc, s) =>
                acc +
                s.machineCheckpoints.reduce((m, c) => m + c.photos.length, 0) +
                s.pokayokeCheckpoints.reduce((p, k) => p + k.photos.length, 0),
              0
            )}{' '}
            <span className="text-sm font-normal text-slate-500">Photos Attached</span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-3 font-mono flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> 100% Watermarked & Geotagged
          </p>
        </div>

        {/* Shift Timer */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Active Manufacturing Shift</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-base font-bold text-amber-700 font-mono truncate">
            {getCurrentShift().split(' ')[0]}
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-mono">
            3-Shift Rotational Monitoring Active
          </p>
        </div>
      </div>

      {/* Filter & Selection Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Minifactory Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {minifactories.map((mf) => (
            <button
              key={mf.id}
              onClick={() => {
                onMinifactoryChange(mf.id);
                if (mf.lines[0]) setSelectedLineId(mf.lines[0].id);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                selectedMinifactoryId === mf.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Factory className="w-3.5 h-3.5" />
              <span>{mf.name}</span>
            </button>
          ))}
        </div>

        {/* Line & Shift Dropdowns */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:w-56">
            <select
              value={selectedLineId}
              onChange={(e) => setSelectedLineId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:border-slate-400"
            >
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-36">
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:border-slate-400"
            >
              <option value="All Shifts">All Shifts</option>
              <option value="Shift 1">Shift 1 (06:00-14:00)</option>
              <option value="Shift 2">Shift 2 (14:00-22:00)</option>
              <option value="Shift 3">Shift 3 (22:00-06:00)</option>
            </select>
          </div>
        </div>
      </div>

      {/* REAL-TIME STATIONS GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-600" />
              Station Status Matrix — {currentLine.name}
            </h3>
            <p className="text-xs text-slate-500">
              Real-time monitoring of all station checklists & Pokayoke error-proofing for {currentMf.name}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map((st) => {
            const photoCount =
              st.machineCheckpoints.reduce((m, c) => m + c.photos.length, 0) +
              st.pokayokeCheckpoints.reduce((p, k) => p + k.photos.length, 0);

            return (
              <div
                key={st.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm transition-all duration-200 flex flex-col justify-between space-y-4 hover:border-slate-300 ${
                  st.status === 'DEVIATION_STOPPED'
                    ? 'border-rose-300 bg-rose-50/20'
                    : st.status === 'COMPLETED'
                    ? 'border-emerald-300 bg-emerald-50/10'
                    : 'border-slate-200'
                }`}
              >
                {/* Station Card Header */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-900 text-sm font-mono">
                        {st.number}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{st.name}</h4>
                        <p className="text-[11px] text-slate-500">{st.lineName}</p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                        st.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : st.status === 'DEVIATION_STOPPED'
                          ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {st.status === 'COMPLETED'
                        ? 'COMPLETED'
                        : st.status === 'DEVIATION_STOPPED'
                        ? 'STATION STOPPED'
                        : 'IN PROGRESS'}
                    </span>
                  </div>

                  {/* Operator Info */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1.5 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Operator:</span>
                      <span className="font-semibold text-slate-800">{st.operatorName || 'Pending'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Last Verified At:</span>
                      <span className="font-mono text-sky-700 font-semibold text-[11px]">{st.lastSubmittedAt || 'Awaiting entry'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Direct Photos:</span>
                      <span className="font-mono text-amber-800 font-bold flex items-center gap-1">
                        <Camera className="w-3 h-3 text-amber-600" /> {photoCount} Captured
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setActiveAuditStation(st)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-slate-200"
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-600" /> View Audit Sheet
                  </button>

                  <button
                    onClick={() => onNavigateToChecklist(st.minifactoryId, st.lineId, st.id)}
                    className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                  >
                    <span>Fill</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* REACTION PLAN / DEVIATION LOG TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Reaction Plan & Countermeasure Log (Plant-Wide)
            </h3>
            <p className="text-xs text-slate-500">
              Live log of all out-of-standard points and Pokayoke failures requiring station stop & corrective action
            </p>
          </div>
          <span className="text-xs font-mono bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-lg">
            {allDeviations.length} Deviations Recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50">
                <th className="py-3 px-3 w-10 text-center">S/N</th>
                <th className="py-3 px-3 w-24">Date</th>
                <th className="py-3 px-3 w-48">Location</th>
                <th className="py-3 px-3">Problem Description</th>
                <th className="py-3 px-3 w-36">Owner</th>
                <th className="py-3 px-3">Countermeasure</th>
                <th className="py-3 px-3 w-28">Target Date</th>
                <th className="py-3 px-3 text-center w-28">Action Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {allDeviations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No active station deviations reported.
                  </td>
                </tr>
              ) : (
                allDeviations.map((dev, idx) => (
                  <tr key={dev.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-mono text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{dev.date}</td>
                    <td className="py-3 px-3 font-semibold text-sky-700">{dev.location}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">{dev.problemDescription}</td>
                    <td className="py-3 px-3 text-amber-800 font-medium">{dev.owner}</td>
                    <td className="py-3 px-3 text-slate-700">{dev.countermeasure}</td>
                    <td className="py-3 px-3 font-mono text-slate-500">{dev.targetDate}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                          dev.status === 'Open'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : dev.status === 'In Progress'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {dev.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Detail Modal */}
      {activeAuditStation && (
        <AuditDetailModal
          isOpen={true}
          onClose={() => setActiveAuditStation(null)}
          station={activeAuditStation}
        />
      )}
    </div>
  );
};
