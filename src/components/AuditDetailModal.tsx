import React from 'react';
import { X, ShieldCheck, MapPin, Clock, Camera, CheckCircle2, XCircle, AlertTriangle, User, FileText } from 'lucide-react';
import { Station } from '../types';

interface AuditDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  station: Station;
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ isOpen, onClose, station }) => {
  if (!isOpen) return null;

  const allPhotos = [
    ...station.machineCheckpoints.flatMap((m) => m.photos.map((p) => ({ ...p, title: m.checkPoint }))),
    ...station.pokayokeCheckpoints.flatMap((p) => p.photos.map((ph) => ({ ...ph, title: `Pokayoke ${p.sn}: ${p.pokayoke}` }))),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 font-bold">
              {station.number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                  Station {station.number} Inspection Audit Record
                </h3>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                    station.status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : station.status === 'DEVIATION_STOPPED'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {station.status === 'COMPLETED'
                    ? 'COMPLETED & VERIFIED'
                    : station.status === 'DEVIATION_STOPPED'
                    ? 'STATION STOPPED (DEVIATION)'
                    : 'IN PROGRESS'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {station.lineName} • Operator: {station.operatorName || 'Unassigned'} ({station.operatorId || 'N/A'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Metadata Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <div className="text-slate-500 text-[10px]">Submitted At</div>
                <div className="font-mono text-slate-900 font-semibold">{station.lastSubmittedAt || 'Just Now'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-700">
              <User className="w-4 h-4 text-sky-600 shrink-0" />
              <div>
                <div className="text-slate-500 text-[10px]">Shift & Operator</div>
                <div className="font-semibold text-slate-900">{station.shift.split(' ')[0]} - {station.operatorName || 'Prakash Rao'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-700">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="text-slate-500 text-[10px]">GPS Verification</div>
                <div className="font-mono text-emerald-700 font-bold">18.5204° N, 73.8567° E (Locked)</div>
              </div>
            </div>
          </div>

          {/* Photos Audit Gallery */}
          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-600" /> Direct Camera Photo Evidence ({allPhotos.length})
            </h4>
            {allPhotos.length === 0 ? (
              <div className="bg-slate-50 p-6 text-center text-slate-500 text-xs rounded-xl border border-slate-200">
                No photo evidence attached yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {allPhotos.map((photo) => (
                  <div key={photo.id} className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <div className="relative aspect-video bg-slate-900 flex items-center justify-center">
                      <img src={photo.dataUrl} alt={photo.title} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-emerald-900/90 border border-emerald-400/50 text-emerald-200 text-[10px] px-2 py-0.5 rounded font-mono flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" /> Hardware Verified
                      </div>
                    </div>
                    <div className="p-3 text-xs space-y-1">
                      <div className="font-bold text-slate-900 line-clamp-1">{photo.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{photo.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkpoint Status Detail */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Machine Points */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-sm">Machine Checkpoints</h4>
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                {station.machineCheckpoints.map((m) => (
                  <div key={m.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">
                        {m.sn}. {m.checkPoint}
                      </div>
                      <div className="text-[10px] text-slate-500">Standard: {m.standard}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        m.status === 'OK'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : m.status === 'NOT_OK'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pokayoke Points */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-sm">Pokayoke Error-Proofing</h4>
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                {station.pokayokeCheckpoints.map((p) => (
                  <div key={p.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">
                        {p.sn}. {p.pokayoke}
                      </div>
                      <div className="text-[10px] text-slate-500">Method: {p.verifyMethod}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        p.status === 'OK'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : p.status === 'NOT_OK'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Deviations / Action Log */}
          {station.deviations.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-rose-700 text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" /> Reaction Plan & Countermeasures
              </h4>
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 space-y-3 text-xs">
                {station.deviations.map((dev) => (
                  <div key={dev.id} className="border-b border-rose-200 last:border-0 pb-2 last:pb-0">
                    <div className="font-bold text-slate-900">{dev.problemDescription}</div>
                    <div className="text-slate-600 mt-1 grid grid-cols-1 sm:grid-cols-3 gap-1 text-[11px]">
                      <div>Owner: <span className="text-amber-800 font-semibold">{dev.owner}</span></div>
                      <div>Target Date: {dev.targetDate}</div>
                      <div>Status: <span className="text-rose-700 font-bold">{dev.status}</span></div>
                    </div>
                    <div className="text-slate-800 text-[11px] mt-1 bg-white p-2 rounded border border-rose-200 shadow-sm">
                      <strong className="text-emerald-700">Countermeasure:</strong> {dev.countermeasure}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
