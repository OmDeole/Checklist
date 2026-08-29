import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  ShieldCheck,
  BarChart3,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Camera,
  XCircle,
  RefreshCw,
  UserCheck,
  Activity,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Minifactory, ChecklistSubmission } from '../types';

// ─── Types ────────────────────────────────────────────────────────

interface OperatorAuditEntry {
  operatorId: string;
  operatorName: string;
  submissions: {
    id: string;
    stationId: string;
    stationNumber: string;
    lineName: string;
    submittedAt: string;
    overallStatus: 'OK' | 'DEVIATION';
    timeTakenSeconds: number;
    verificationHash: string;
    photoCount: number;
    isAuthentic: boolean;
  }[];
  totalOk: number;
  totalDeviation: number;
  avgTime: number;
  complianceRate: number;
}

interface AuditSummary {
  totalSubmissions: number;
  totalDeviations: number;
  openDeviations: number;
  inProgressDeviations: number;
  resolvedDeviations: number;
}

interface DeviationEntry {
  id: string;
  sn: number;
  date: string;
  timestamp: string;
  minifactoryId: string;
  lineId: string;
  stationId: string;
  location: string;
  problemDescription: string;
  owner: string;
  countermeasure: string;
  targetDate: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  checkpointName?: string;
}

// ─── Helper ──────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3001';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

// ─── Component ───────────────────────────────────────────────────

interface CoordinatorAdminProps {
  minifactories: Minifactory[];
  selectedMinifactoryId: string;
}

export const CoordinatorAdmin: React.FC<CoordinatorAdminProps> = ({
  minifactories,
  selectedMinifactoryId,
}) => {
  const [operators, setOperators] = useState<OperatorAuditEntry[]>([]);
  const [summary, setSummary] = useState<AuditSummary>({
    totalSubmissions: 0,
    totalDeviations: 0,
    openDeviations: 0,
    inProgressDeviations: 0,
    resolvedDeviations: 0,
  });
  const [deviations, setDeviations] = useState<DeviationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedOperator, setExpandedOperator] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'operators' | 'deviations' | 'overview'>('overview');

  // Fetch data from backend
  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const [auditRes, devRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/audit`),
        fetch(`${API_BASE}/api/deviations`),
      ]);

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setOperators(auditData.operators || []);
        setSummary(auditData.summary || summary);
        setBackendOnline(true);
      }

      if (devRes.ok) {
        const devData = await devRes.json();
        setDeviations(devData.deviations || []);
      }
    } catch (err) {
      console.warn('Backend not available, using local data fallback');
      setBackendOnline(false);
      buildLocalFallback();
    } finally {
      setLoading(false);
    }
  };

  // Fallback: build audit data from local minifactory state
  const buildLocalFallback = () => {
    const allStations = minifactories.flatMap((mf) =>
      mf.lines.flatMap((l) => l.stations)
    );

    const operatorMap = new Map<string, OperatorAuditEntry>();

    for (const station of allStations) {
      if (!station.operatorId) continue;
      const key = station.operatorId;

      if (!operatorMap.has(key)) {
        operatorMap.set(key, {
          operatorId: station.operatorId,
          operatorName: station.operatorName || 'Unknown',
          submissions: [],
          totalOk: 0,
          totalDeviation: 0,
          avgTime: 0,
          complianceRate: 0,
        });
      }

      const entry = operatorMap.get(key)!;
      if (station.status === 'COMPLETED' || station.status === 'DEVIATION_STOPPED') {
        const isOk = station.status === 'COMPLETED';
        entry.submissions.push({
          id: `local-${station.id}`,
          stationId: station.id,
          stationNumber: station.number,
          lineName: station.lineName,
          submittedAt: station.lastSubmittedAt || new Date().toISOString(),
          overallStatus: isOk ? 'OK' : 'DEVIATION',
          timeTakenSeconds: 0,
          verificationHash: '',
          photoCount: station.machineCheckpoints.reduce((n, c) => n + c.photos.length, 0) +
            station.pokayokeCheckpoints.reduce((n, c) => n + c.photos.length, 0),
          isAuthentic: !station.isFlaggedForFalsification,
        });
        if (isOk) entry.totalOk++;
        else entry.totalDeviation++;
      }
    }

    for (const [, entry] of operatorMap) {
      const total = entry.totalOk + entry.totalDeviation;
      entry.complianceRate = total > 0 ? Math.round((entry.totalOk / total) * 100) : 100;
    }

    setOperators(Array.from(operatorMap.values()));

    // Collect deviations from stations
    const localDevs = allStations.flatMap((st) =>
      st.deviations.map((d: any) => ({ ...d }))
    );
    setDeviations(localDevs);

    setSummary({
      totalSubmissions: Array.from(operatorMap.values()).reduce((s, o) => s + o.submissions.length, 0),
      totalDeviations: localDevs.length,
      openDeviations: localDevs.filter((d: any) => d.status === 'Open').length,
      inProgressDeviations: localDevs.filter((d: any) => d.status === 'In Progress').length,
      resolvedDeviations: localDevs.filter((d: any) => d.status === 'Resolved').length,
    });
  };

  useEffect(() => {
    fetchAuditData();
  }, [selectedMinifactoryId]);

  // Filter operators by search
  const filteredOperators = operators.filter((op) => {
    const matchesSearch =
      !searchQuery ||
      op.operatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      op.operatorId.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  // Handle deviation status update
  const handleDeviationUpdate = async (devId: string, newStatus: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/deviations/${devId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setDeviations((prev) =>
          prev.map((d) => (d.id === devId ? { ...d, status: newStatus as any } : d))
        );
      }
    } catch {
      console.warn('Failed to update deviation (backend offline)');
    }
  };

  // Export handler
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/export?format=${format}`);
      if (res.ok) {
        if (format === 'csv') {
          const text = await res.text();
          const blob = new Blob([text], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tpm-audit-report-${Date.now()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          const data = await res.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tpm-audit-report-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch {
      console.warn('Export failed (backend offline)');
    }
  };

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-violet-600" />
            Coordinator Audit Portal
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Per-employee audit matrix, evidence inspection, and compliance reporting
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Backend status */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              backendOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            {backendOnline ? 'Backend Connected' : 'Local Mode'}
          </div>

          <button
            onClick={fetchAuditData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            onClick={() => handleExport('json')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-5 h-5 text-sky-500" />
            <span className="text-xs text-slate-400 font-medium">Total</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{summary.totalSubmissions}</p>
          <p className="text-xs text-slate-500 mt-0.5">Submissions</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <span className="text-xs text-slate-400 font-medium">Active</span>
          </div>
          <p className="text-2xl font-bold text-rose-600">{summary.openDeviations}</p>
          <p className="text-xs text-slate-500 mt-0.5">Open Deviations</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <span className="text-xs text-slate-400 font-medium">WIP</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{summary.inProgressDeviations}</p>
          <p className="text-xs text-slate-500 mt-0.5">In Progress</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="text-xs text-slate-400 font-medium">Closed</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{summary.resolvedDeviations}</p>
          <p className="text-xs text-slate-500 mt-0.5">Resolved</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-violet-500" />
            <span className="text-xs text-slate-400 font-medium">Operators</span>
          </div>
          <p className="text-2xl font-bold text-violet-600">{operators.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Tracked</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 mb-6 w-fit">
        {(['overview', 'operators', 'deviations'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
              activeTab === tab
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'operators' ? 'Operator Audits' : 'Deviation Log'}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ──────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Compliance Heatmap */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Operator Compliance Matrix
            </h3>

            {operators.length === 0 ? (
              <p className="text-slate-400 text-sm py-8 text-center">
                No submissions recorded yet. Operator data will appear here after checklist submissions.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">Operator</th>
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">ID</th>
                      <th className="text-center py-2 px-3 text-slate-500 font-medium">Submissions</th>
                      <th className="text-center py-2 px-3 text-slate-500 font-medium">OK</th>
                      <th className="text-center py-2 px-3 text-slate-500 font-medium">Deviations</th>
                      <th className="text-center py-2 px-3 text-slate-500 font-medium">Compliance</th>
                      <th className="text-center py-2 px-3 text-slate-500 font-medium">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operators.map((op) => {
                      const total = op.totalOk + op.totalDeviation;
                      return (
                        <tr key={op.operatorId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-medium text-slate-900">{op.operatorName}</td>
                          <td className="py-3 px-3 text-slate-500 font-mono text-xs">{op.operatorId}</td>
                          <td className="py-3 px-3 text-center">{total}</td>
                          <td className="py-3 px-3 text-center text-emerald-600 font-semibold">{op.totalOk}</td>
                          <td className="py-3 px-3 text-center text-rose-600 font-semibold">{op.totalDeviation}</td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                op.complianceRate >= 90
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : op.complianceRate >= 70
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {op.complianceRate >= 90 ? (
                                <ArrowUpRight className="w-3 h-3" />
                              ) : (
                                <ArrowDownRight className="w-3 h-3" />
                              )}
                              {op.complianceRate}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center text-slate-500 font-mono text-xs">
                            {formatDuration(op.avgTime)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Operators Tab ─────────────────────────────────────────── */}
      {activeTab === 'operators' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by operator name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
              />
            </div>
          </div>

          {/* Operator Cards */}
          {filteredOperators.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No operators found</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery ? 'Try a different search term' : 'Submissions will appear after operators complete checklists'}
              </p>
            </div>
          ) : (
            filteredOperators.map((op) => {
              const isExpanded = expandedOperator === op.operatorId;
              const total = op.totalOk + op.totalDeviation;

              return (
                <div
                  key={op.operatorId}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  {/* Operator Header */}
                  <button
                    onClick={() => setExpandedOperator(isExpanded ? null : op.operatorId)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                        {op.operatorName.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-slate-900">{op.operatorName}</p>
                        <p className="text-xs text-slate-500 font-mono">{op.operatorId}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {op.totalOk} OK
                        </span>
                        <span className="flex items-center gap-1 text-rose-600 font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          {op.totalDeviation} DEV
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold ${
                            op.complianceRate >= 90
                              ? 'bg-emerald-100 text-emerald-700'
                              : op.complianceRate >= 70
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {op.complianceRate}%
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Submission Details */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                      {op.submissions.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">No submissions recorded</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-2 px-2 text-slate-500 font-medium">Station</th>
                                <th className="text-left py-2 px-2 text-slate-500 font-medium">Line</th>
                                <th className="text-center py-2 px-2 text-slate-500 font-medium">Status</th>
                                <th className="text-center py-2 px-2 text-slate-500 font-medium">Photos</th>
                                <th className="text-center py-2 px-2 text-slate-500 font-medium">Time</th>
                                <th className="text-left py-2 px-2 text-slate-500 font-medium">Submitted</th>
                                <th className="text-center py-2 px-2 text-slate-500 font-medium">Authentic</th>
                                <th className="text-left py-2 px-2 text-slate-500 font-medium">Hash</th>
                              </tr>
                            </thead>
                            <tbody>
                              {op.submissions.map((sub) => (
                                <tr
                                  key={sub.id}
                                  className="border-b border-slate-100 hover:bg-white transition-colors"
                                >
                                  <td className="py-2 px-2 font-mono font-semibold text-slate-900">
                                    St-{sub.stationNumber}
                                  </td>
                                  <td className="py-2 px-2 text-slate-600">{sub.lineName}</td>
                                  <td className="py-2 px-2 text-center">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        sub.overallStatus === 'OK'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-rose-100 text-rose-700'
                                      }`}
                                    >
                                      {sub.overallStatus === 'OK' ? (
                                        <CheckCircle2 className="w-3 h-3" />
                                      ) : (
                                        <AlertTriangle className="w-3 h-3" />
                                      )}
                                      {sub.overallStatus}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <span className="flex items-center justify-center gap-1 text-slate-600">
                                      <Camera className="w-3 h-3" />
                                      {sub.photoCount}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-center text-slate-500 font-mono">
                                    {formatDuration(sub.timeTakenSeconds)}
                                  </td>
                                  <td className="py-2 px-2 text-slate-500">
                                    {formatDate(sub.submittedAt)} {formatTime(sub.submittedAt)}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    {sub.isAuthentic ? (
                                      <UserCheck className="w-4 h-4 text-emerald-500 mx-auto" />
                                    ) : (
                                      <AlertTriangle className="w-4 h-4 text-rose-500 mx-auto" />
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-slate-400 font-mono text-[10px] max-w-[120px] truncate">
                                    {sub.verificationHash || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Deviations Tab ────────────────────────────────────────── */}
      {activeTab === 'deviations' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              {['all', 'Open', 'In Progress', 'Resolved'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    filterStatus === status
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status === 'all' ? 'All' : status}
                </button>
              ))}
            </div>
          </div>

          {/* Deviation Cards */}
          {deviations
            .filter((d) => filterStatus === 'all' || d.status === filterStatus)
            .map((dev) => (
              <div
                key={dev.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          dev.status === 'Open'
                            ? 'bg-rose-100 text-rose-700'
                            : dev.status === 'In Progress'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {dev.status === 'Open' ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : dev.status === 'In Progress' ? (
                          <Clock className="w-3 h-3" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {dev.status}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">{dev.id}</span>
                      {dev.checkpointName && (
                        <span className="text-xs text-sky-600 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                          {dev.checkpointName}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-slate-900 mb-1">{dev.problemDescription}</p>

                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                      <span>📍 {dev.location}</span>
                      <span>📅 {dev.date}</span>
                      <span>👤 {dev.owner}</span>
                    </div>

                    {dev.countermeasure && (
                      <div className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2">
                        <strong>Countermeasure:</strong> {dev.countermeasure}
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {dev.status === 'Open' && (
                      <button
                        onClick={() => handleDeviationUpdate(dev.id, 'In Progress')}
                        className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                      >
                        Start WIP
                      </button>
                    )}
                    {(dev.status === 'Open' || dev.status === 'In Progress') && (
                      <button
                        onClick={() => handleDeviationUpdate(dev.id, 'Resolved')}
                        className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

          {deviations.filter((d) => filterStatus === 'all' || d.status === filterStatus).length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No deviations found</p>
              <p className="text-xs text-slate-400 mt-1">
                {filterStatus !== 'all' ? `No ${filterStatus.toLowerCase()} deviations` : 'All clear!'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
