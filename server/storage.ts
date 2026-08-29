/**
 * JSON-File Persistent Storage — Modular data layer for submissions, deviations, and station state.
 *
 * Uses flat JSON files on disk for zero-dependency persistence.
 * Designed with a clean repository interface so it can be swapped to PostgreSQL
 * when merged into KSPG Cockpit without changing consumer code.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { loadMasterConfig } from '../src/config/masterConfig.js';

// ─── Types ────────────────────────────────────────────────────────

export interface StoredSubmission {
  id: string;
  minifactoryId: string;
  lineId: string;
  stationId: string;
  stationNumber: string;
  lineName: string;
  operatorName: string;
  operatorId: string;
  shift: string;
  submittedAt: string;
  completedAt: string;
  timeTakenSeconds: number;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    address?: string;
    isWithinGeofence: boolean;
  };
  machineCheckpoints: any[];
  pokayokeCheckpoints: any[];
  deviations: any[];
  overallStatus: 'OK' | 'DEVIATION';
  verificationHash: string;
  isAuthentic: boolean;
  photoEvidenceKeys: string[]; // MinIO object keys
}

export interface StoredDeviation {
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
  photoEvidenceUrl?: string;
  assignedTo?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface StationState {
  stationId: string;
  minifactoryId: string;
  lineId: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'DEVIATION_STOPPED';
  lastSubmittedAt?: string;
  completionPercentage: number;
  currentOperatorId?: string;
  lastVerificationHash?: string;
}

// ─── Storage Engine ──────────────────────────────────────────────

class JsonFileStore<T extends { id: string }> {
  private filePath: string;
  private cache: T[] | null = null;

  constructor(fileName: string) {
    const cfg = loadMasterConfig().dataStore;
    this.filePath = resolve(process.cwd(), cfg.basePath, fileName);

    // Ensure directory exists
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Initialize file if not present
    if (!existsSync(this.filePath)) {
      writeFileSync(this.filePath, '[]', 'utf-8');
    }
  }

  private load(): T[] {
    if (this.cache) return this.cache;
    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      this.cache = JSON.parse(raw) as T[];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  private save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.cache || [], null, 2), 'utf-8');
  }

  getAll(): T[] {
    return [...this.load()];
  }

  getById(id: string): T | undefined {
    return this.load().find((item) => item.id === id);
  }

  query(predicate: (item: T) => boolean): T[] {
    return this.load().filter(predicate);
  }

  insert(item: T): T {
    const items = this.load();
    items.push(item);
    this.cache = items;
    this.save();
    return item;
  }

  update(id: string, partial: Partial<T>): T | undefined {
    const items = this.load();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return undefined;

    items[index] = { ...items[index], ...partial };
    this.cache = items;
    this.save();
    return items[index];
  }

  delete(id: string): boolean {
    const items = this.load();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return false;

    items.splice(index, 1);
    this.cache = items;
    this.save();
    return true;
  }

  count(): number {
    return this.load().length;
  }

  /**
   * Invalidate cache (e.g., on external file changes).
   */
  refresh(): void {
    this.cache = null;
  }
}

// ─── Repository Instances ─────────────────────────────────────────

let _submissions: JsonFileStore<StoredSubmission> | null = null;
let _deviations: JsonFileStore<StoredDeviation> | null = null;
let _stationState: JsonFileStore<StationState> | null = null;

export function getSubmissionsStore(): JsonFileStore<StoredSubmission> {
  if (!_submissions) {
    const cfg = loadMasterConfig().dataStore;
    _submissions = new JsonFileStore<StoredSubmission>(cfg.files.submissions);
  }
  return _submissions;
}

export function getDeviationsStore(): JsonFileStore<StoredDeviation> {
  if (!_deviations) {
    const cfg = loadMasterConfig().dataStore;
    _deviations = new JsonFileStore<StoredDeviation>(cfg.files.deviations);
  }
  return _deviations;
}

export function getStationStateStore(): JsonFileStore<StationState> {
  if (!_stationState) {
    const cfg = loadMasterConfig().dataStore;
    _stationState = new JsonFileStore<StationState>(cfg.files.stationState);
  }
  return _stationState;
}

// ─── Utility Helpers ──────────────────────────────────────────────

/**
 * Generate a unique ID with a given prefix.
 */
export function generateId(prefix: string = 'id'): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

/**
 * Get aggregated stats for a specific operator.
 */
export function getOperatorStats(operatorId: string) {
  const submissions = getSubmissionsStore().query((s) => s.operatorId === operatorId);
  const deviations = getDeviationsStore().query((d) => {
    // Check if any submission from this operator is linked to this deviation
    return submissions.some((s) => s.stationId === d.stationId);
  });

  const totalSubmissions = submissions.length;
  const okSubmissions = submissions.filter((s) => s.overallStatus === 'OK').length;
  const deviationSubmissions = submissions.filter((s) => s.overallStatus === 'DEVIATION').length;
  const avgTimeTaken =
    totalSubmissions > 0
      ? Math.round(submissions.reduce((sum, s) => sum + s.timeTakenSeconds, 0) / totalSubmissions)
      : 0;

  return {
    operatorId,
    totalSubmissions,
    okSubmissions,
    deviationSubmissions,
    complianceRate: totalSubmissions > 0 ? Math.round((okSubmissions / totalSubmissions) * 100) : 0,
    avgTimeTakenSeconds: avgTimeTaken,
    openDeviations: deviations.filter((d) => d.status === 'Open').length,
    inProgressDeviations: deviations.filter((d) => d.status === 'In Progress').length,
    resolvedDeviations: deviations.filter((d) => d.status === 'Resolved').length,
    lastSubmission: submissions.length > 0 ? submissions[submissions.length - 1].submittedAt : null,
  };
}
