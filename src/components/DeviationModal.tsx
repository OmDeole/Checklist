import React, { useState } from 'react';
import { AlertTriangle, X, Check, Clock, User, Calendar, FileText, Wrench } from 'lucide-react';
import { DeviationLog } from '../types';
import { formatTimestamp } from '../utils/geolocation';

interface DeviationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deviation: DeviationLog) => void;
  stationNumber: string;
  minifactoryId: string;
  lineId: string;
  locationLabel: string;
  checkpointName?: string;
}

export const DeviationModal: React.FC<DeviationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  stationNumber,
  minifactoryId,
  lineId,
  locationLabel,
  checkpointName,
}) => {
  const [problemDescription, setProblemDescription] = useState<string>(
    checkpointName ? `Out of standard observed during '${checkpointName}' inspection.` : ''
  );
  const [owner, setOwner] = useState<string>('Line Shift Lead / Maintenance');
  const [countermeasure, setCountermeasure] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<'Open' | 'In Progress' | 'Resolved'>('In Progress');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemDescription.trim()) return;

    const newDeviation: DeviationLog = {
      id: `dev-${Date.now()}`,
      sn: Math.floor(Math.random() * 90) + 10,
      date: new Date().toISOString().split('T')[0],
      timestamp: formatTimestamp(new Date()),
      minifactoryId,
      lineId,
      stationId: `st-${stationNumber}`,
      location: locationLabel,
      problemDescription,
      owner,
      countermeasure: countermeasure || 'Station stopped; pending root cause analysis.',
      targetDate,
      status,
      checkpointName,
    };

    onSave(newDeviation);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-rose-50 border-b border-rose-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Station Reaction Plan & Deviation Log</h3>
              <p className="text-xs text-rose-700 font-medium">
                Rule: If check point / Pokayoke is NOT OK, stop station and log countermeasure.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between font-medium">
            <span className="font-semibold text-slate-500">Location Tag:</span>
            <span className="font-mono text-sky-700">{locationLabel} (Station {stationNumber})</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-rose-600" /> Problem Description <span className="text-rose-600">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="Describe the exact out-of-standard condition or Pokayoke failure..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-slate-400 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-600" /> Action Owner
              </label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-600" /> Target Resolution Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-sky-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-emerald-600" /> Countermeasure / Immediate Action
            </label>
            <textarea
              rows={2}
              value={countermeasure}
              onChange={(e) => setCountermeasure(e.target.value)}
              placeholder="Enter immediate corrective action taken or planned..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Action Status</label>
            <div className="flex gap-2">
              {(['Open', 'In Progress', 'Resolved'] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    status === s
                      ? s === 'Open'
                        ? 'bg-rose-100 border-rose-300 text-rose-800'
                        : s === 'In Progress'
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-emerald-100 border-emerald-300 text-emerald-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-sm flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Save Deviation & Alert Line
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
