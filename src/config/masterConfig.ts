/**
 * Master Configuration — Typed TypeScript wrapper for master_config.json
 * Single source of truth for KSPG Cockpit integration contracts.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Type Definitions ─────────────────────────────────────────────

export interface ModuleConfig {
  appId: string;
  displayName: string;
  version: string;
  description: string;
  parentMountPath: string;
  icon: string;
}

export interface StorageConfig {
  provider: 'minio' | 's3';
  endpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  useSSL: boolean;
  publicBaseUrl: string;
  objectPrefix: string;
  maxFileSizeMB: number;
  allowedMimeTypes: string[];
}

export interface ServerConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  apiPrefix: string;
}

export interface RoutesConfig {
  config: string;
  health: string;
  minifactories: string;
  submitChecklist: string;
  submissions: string;
  deviations: string;
  deviationPatch: string;
  adminAudit: string;
  adminOperators: string;
  adminExport: string;
  aiVerifyGauge: string;
}

export interface GaugeTolerance {
  min: number;
  max: number;
  unit: string;
}

export interface AIConfig {
  enabled: boolean;
  provider: string;
  gaugeVerification: {
    tolerances: Record<string, GaugeTolerance>;
    confidenceThreshold: number;
  };
}

export interface AuthConfig {
  headerSchemas: {
    userId: string;
    role: string;
    sessionToken: string;
  };
  roles: string[];
  defaultRole: string;
}

export interface DataStoreConfig {
  type: 'json-file' | 'postgresql';
  basePath: string;
  files: {
    submissions: string;
    deviations: string;
    stationState: string;
  };
}

export interface MasterConfig {
  module: ModuleConfig;
  storage: StorageConfig;
  server: ServerConfig;
  routes: RoutesConfig;
  ai: AIConfig;
  auth: AuthConfig;
  dataStore: DataStoreConfig;
}

// ─── Config Loader ────────────────────────────────────────────────

let _cachedConfig: MasterConfig | null = null;

/**
 * Load the master configuration from master_config.json.
 * Result is cached in memory after first load.
 */
export function loadMasterConfig(): MasterConfig {
  if (_cachedConfig) return _cachedConfig;

  const configPath = resolve(process.cwd(), 'master_config.json');
  const raw = readFileSync(configPath, 'utf-8');
  _cachedConfig = JSON.parse(raw) as MasterConfig;
  return _cachedConfig;
}

/**
 * Get a specific section from master config.
 */
export function getConfigSection<K extends keyof MasterConfig>(section: K): MasterConfig[K] {
  return loadMasterConfig()[section];
}

/**
 * Reset the cached config (useful for testing or hot-reload).
 */
export function resetConfigCache(): void {
  _cachedConfig = null;
}

// ─── Frontend-safe Config (no secrets) ────────────────────────────

export interface PublicConfig {
  module: ModuleConfig;
  server: Pick<ServerConfig, 'port' | 'apiPrefix'>;
  routes: RoutesConfig;
  ai: Pick<AIConfig, 'enabled' | 'gaugeVerification'>;
  auth: Pick<AuthConfig, 'roles' | 'defaultRole'>;
}

/**
 * Returns config safe to send to the frontend (strips credentials).
 */
export function getPublicConfig(): PublicConfig {
  const cfg = loadMasterConfig();
  return {
    module: cfg.module,
    server: { port: cfg.server.port, apiPrefix: cfg.server.apiPrefix },
    routes: cfg.routes,
    ai: { enabled: cfg.ai.enabled, gaugeVerification: cfg.ai.gaugeVerification },
    auth: { roles: cfg.auth.roles, defaultRole: cfg.auth.defaultRole },
  };
}
