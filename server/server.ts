/**
 * TPM Smart Verify — Express Backend Server
 *
 * Lightweight API server for the KSPG Cockpit TPM Checklist module.
 * Integrates MinIO S3 for photo evidence, JSON-file persistence,
 * and AI gauge verification hooks.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { loadMasterConfig, getPublicConfig } from '../src/config/masterConfig.js';
import { ensureBucketExists, uploadEvidence, checkMinioHealth, listEvidence, getEvidenceUrl } from './minioClient.js';
import {
  getSubmissionsStore,
  getDeviationsStore,
  getStationStateStore,
  generateId,
  getOperatorStats,
  StoredSubmission,
  StoredDeviation,
  StationState,
} from './storage.js';

// ─── Load Config ─────────────────────────────────────────────────

const config = loadMasterConfig();
const app = express();

// ─── Middleware ───────────────────────────────────────────────────

app.use(cors({ origin: config.server.corsOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' })); // Large limit for base64 photo payloads
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ─── API Routes ──────────────────────────────────────────────────

// ── GET /api/config — Public master config for frontend
app.get(config.routes.config, (_req: Request, res: Response) => {
  res.json(getPublicConfig());
});

// ── GET /api/health — Server + MinIO health check
app.get(config.routes.health, async (_req: Request, res: Response) => {
  const startTime = process.uptime();
  const minioHealth = await checkMinioHealth();
  const submissionCount = getSubmissionsStore().count();
  const deviationCount = getDeviationsStore().count();

  res.json({
    status: minioHealth.connected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.round(startTime),
    module: config.module.appId,
    version: config.module.version,
    minio: minioHealth,
    storage: {
      submissions: submissionCount,
      deviations: deviationCount,
    },
  });
});

// ── GET /api/minifactories — Returns factory/line/station structure
app.get(config.routes.minifactories, (_req: Request, res: Response) => {
  // Return station states from our store, or empty if none saved yet
  const stationStates = getStationStateStore().getAll();

  res.json({
    stationStates,
    message: 'Station states from server storage. Full minifactory structure is managed client-side.',
  });
});

// ── POST /api/checklists/submit — Save submission + upload photos to MinIO
app.post(config.routes.submitChecklist, async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Generate submission ID
    const submissionId = generateId('sub');
    const timestamp = new Date().toISOString();

    // Extract and upload photo evidence to MinIO
    const photoEvidenceKeys: string[] = [];

    // Process machine checkpoint photos
    for (const checkpoint of body.machineCheckpoints || []) {
      for (const photo of checkpoint.photos || []) {
        if (photo.dataUrl) {
          const objectKey = `${body.minifactoryId}/${body.stationId}/${submissionId}/machine-${checkpoint.id}-${photo.id}.jpg`;
          try {
            const result = await uploadEvidence(objectKey, photo.dataUrl, 'image/jpeg', {
              operatorId: body.operatorId || 'unknown',
              stationId: body.stationId || 'unknown',
              minifactoryId: body.minifactoryId || 'unknown',
              checkpointId: checkpoint.id || 'unknown',
              shift: body.shift || 'unknown',
              capturedAt: photo.timestamp || timestamp,
            });
            photoEvidenceKeys.push(result.key);
            // Replace the base64 dataUrl with the MinIO URL in the stored record
            photo.minioUrl = result.url;
            photo.minioKey = result.key;
            // Remove bulky base64 from storage
            delete photo.dataUrl;
          } catch (uploadErr: any) {
            console.error(`Photo upload failed for ${objectKey}:`, uploadErr.message);
            // Continue with submission even if photo upload fails
          }
        }
      }
    }

    // Process pokayoke checkpoint photos
    for (const checkpoint of body.pokayokeCheckpoints || []) {
      for (const photo of checkpoint.photos || []) {
        if (photo.dataUrl) {
          const objectKey = `${body.minifactoryId}/${body.stationId}/${submissionId}/pokayoke-${checkpoint.id}-${photo.id}.jpg`;
          try {
            const result = await uploadEvidence(objectKey, photo.dataUrl, 'image/jpeg', {
              operatorId: body.operatorId || 'unknown',
              stationId: body.stationId || 'unknown',
              minifactoryId: body.minifactoryId || 'unknown',
              checkpointId: checkpoint.id || 'unknown',
              shift: body.shift || 'unknown',
              capturedAt: photo.timestamp || timestamp,
            });
            photoEvidenceKeys.push(result.key);
            photo.minioUrl = result.url;
            photo.minioKey = result.key;
            delete photo.dataUrl;
          } catch (uploadErr: any) {
            console.error(`Photo upload failed for ${objectKey}:`, uploadErr.message);
          }
        }
      }
    }

    // Store submission
    const submission: StoredSubmission = {
      id: submissionId,
      minifactoryId: body.minifactoryId,
      lineId: body.lineId,
      stationId: body.stationId,
      stationNumber: body.stationNumber || '',
      lineName: body.lineName || '',
      operatorName: body.operatorName || '',
      operatorId: body.operatorId || '',
      shift: body.shift || '',
      submittedAt: timestamp,
      completedAt: body.completedAt || timestamp,
      timeTakenSeconds: body.timeTakenSeconds || 0,
      location: body.location || { latitude: 0, longitude: 0, accuracy: 0, isWithinGeofence: false },
      machineCheckpoints: body.machineCheckpoints || [],
      pokayokeCheckpoints: body.pokayokeCheckpoints || [],
      deviations: body.deviations || [],
      overallStatus: body.overallStatus || 'OK',
      verificationHash: body.verificationHash || '',
      isAuthentic: body.isAuthentic ?? true,
      photoEvidenceKeys,
    };

    getSubmissionsStore().insert(submission);

    // Store any new deviations
    for (const dev of body.deviations || []) {
      const existing = getDeviationsStore().getById(dev.id);
      if (!existing) {
        getDeviationsStore().insert({
          ...dev,
          id: dev.id || generateId('dev'),
        });
      }
    }

    // Update station state
    const existingState = getStationStateStore().getById(body.stationId);
    const stationUpdate: StationState = {
      stationId: body.stationId,
      minifactoryId: body.minifactoryId,
      lineId: body.lineId,
      status: body.overallStatus === 'DEVIATION' ? 'DEVIATION_STOPPED' : 'COMPLETED',
      lastSubmittedAt: timestamp,
      completionPercentage: 100,
      currentOperatorId: body.operatorId,
      lastVerificationHash: body.verificationHash,
    };

    if (existingState) {
      getStationStateStore().update(body.stationId, stationUpdate);
    } else {
      getStationStateStore().insert(stationUpdate);
    }

    console.log(`✓ Submission ${submissionId} saved | ${photoEvidenceKeys.length} photos uploaded to MinIO`);

    res.status(201).json({
      success: true,
      submissionId,
      photosUploaded: photoEvidenceKeys.length,
      photoKeys: photoEvidenceKeys,
      timestamp,
    });
  } catch (err: any) {
    console.error('Submission error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/submissions — Fetch submissions with filters
app.get(config.routes.submissions, (req: Request, res: Response) => {
  const { operatorId, stationId, shift, date, minifactoryId, lineId, limit } = req.query;
  const store = getSubmissionsStore();

  let results = store.getAll();

  if (operatorId) results = results.filter((s) => s.operatorId === operatorId);
  if (stationId) results = results.filter((s) => s.stationId === stationId);
  if (shift) results = results.filter((s) => s.shift === shift);
  if (minifactoryId) results = results.filter((s) => s.minifactoryId === minifactoryId);
  if (lineId) results = results.filter((s) => s.lineId === lineId);
  if (date) {
    const dateStr = String(date);
    results = results.filter((s) => s.submittedAt.startsWith(dateStr));
  }

  // Sort newest first
  results.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  // Apply limit
  if (limit) {
    results = results.slice(0, Number(limit));
  }

  res.json({ submissions: results, total: results.length });
});

// ── GET /api/deviations — List deviations with filters
app.get(config.routes.deviations, (req: Request, res: Response) => {
  const { status, minifactoryId, stationId } = req.query;
  const store = getDeviationsStore();

  let results = store.getAll();

  if (status) results = results.filter((d) => d.status === status);
  if (minifactoryId) results = results.filter((d) => d.minifactoryId === minifactoryId);
  if (stationId) results = results.filter((d) => d.stationId === stationId);

  // Sort newest first
  results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json({ deviations: results, total: results.length });
});

// ── PATCH /api/deviations/:id — Update deviation status/countermeasure
app.patch('/api/deviations/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const updated = getDeviationsStore().update(id, {
    ...updates,
    ...(updates.status === 'Resolved' ? { resolvedAt: new Date().toISOString() } : {}),
  });

  if (!updated) {
    res.status(404).json({ error: `Deviation ${id} not found` });
    return;
  }

  console.log(`✓ Deviation ${id} updated: status=${updated.status}`);
  res.json({ success: true, deviation: updated });
});

// ── GET /api/admin/audit — Coordinator audit overview
app.get('/api/admin/audit', (req: Request, res: Response) => {
  const { operatorId, date, shift, minifactoryId } = req.query;
  const submissions = getSubmissionsStore().getAll();
  const deviations = getDeviationsStore().getAll();

  // Build operator summary map
  const operatorMap = new Map<string, any>();

  for (const sub of submissions) {
    const key = sub.operatorId || 'unknown';
    if (!operatorMap.has(key)) {
      operatorMap.set(key, {
        operatorId: sub.operatorId,
        operatorName: sub.operatorName,
        submissions: [],
        totalOk: 0,
        totalDeviation: 0,
        avgTime: 0,
      });
    }
    const entry = operatorMap.get(key);
    entry.submissions.push({
      id: sub.id,
      stationId: sub.stationId,
      stationNumber: sub.stationNumber,
      lineName: sub.lineName,
      submittedAt: sub.submittedAt,
      overallStatus: sub.overallStatus,
      timeTakenSeconds: sub.timeTakenSeconds,
      verificationHash: sub.verificationHash,
      photoCount: sub.photoEvidenceKeys?.length || 0,
      isAuthentic: sub.isAuthentic,
    });
    if (sub.overallStatus === 'OK') entry.totalOk++;
    else entry.totalDeviation++;
  }

  // Calculate averages
  for (const [, entry] of operatorMap) {
    const total = entry.submissions.length;
    entry.avgTime =
      total > 0
        ? Math.round(entry.submissions.reduce((s: number, sub: any) => s + sub.timeTakenSeconds, 0) / total)
        : 0;
    entry.complianceRate = total > 0 ? Math.round((entry.totalOk / total) * 100) : 0;
  }

  res.json({
    operators: Array.from(operatorMap.values()),
    summary: {
      totalSubmissions: submissions.length,
      totalDeviations: deviations.length,
      openDeviations: deviations.filter((d) => d.status === 'Open').length,
      inProgressDeviations: deviations.filter((d) => d.status === 'In Progress').length,
      resolvedDeviations: deviations.filter((d) => d.status === 'Resolved').length,
    },
  });
});

// ── GET /api/admin/operators — Operator-level stats
app.get('/api/admin/operators', (req: Request, res: Response) => {
  const submissions = getSubmissionsStore().getAll();

  // Extract unique operator IDs
  const operatorIds = [...new Set(submissions.map((s) => s.operatorId).filter(Boolean))];

  const stats = operatorIds.map((opId) => getOperatorStats(opId));

  res.json({ operators: stats });
});

// ── GET /api/admin/export — Export CSV/JSON compliance reports
app.get('/api/admin/export', (req: Request, res: Response) => {
  const { format = 'json' } = req.query;
  const submissions = getSubmissionsStore().getAll();
  const deviations = getDeviationsStore().getAll();

  if (format === 'csv') {
    // Generate CSV
    const headers = [
      'Submission ID',
      'Operator',
      'Operator ID',
      'Station',
      'Line',
      'Shift',
      'Status',
      'Time (s)',
      'Submitted At',
      'Verification Hash',
      'Photos',
      'Authentic',
    ];

    const rows = submissions.map((s) => [
      s.id,
      s.operatorName,
      s.operatorId,
      s.stationNumber,
      s.lineName,
      s.shift,
      s.overallStatus,
      s.timeTakenSeconds,
      s.submittedAt,
      s.verificationHash,
      s.photoEvidenceKeys?.length || 0,
      s.isAuthentic,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=tpm-audit-report-${Date.now()}.csv`);
    res.send(csv);
  } else {
    res.json({
      exportedAt: new Date().toISOString(),
      submissions,
      deviations,
      summary: {
        totalSubmissions: submissions.length,
        totalDeviations: deviations.length,
      },
    });
  }
});

// ── POST /api/ai/verify-gauge — AI gauge reading verification hook
app.post(config.routes.aiVerifyGauge, async (req: Request, res: Response) => {
  const { photoDataUrl, checkpointId, expectedRange } = req.body;

  if (!photoDataUrl) {
    res.status(400).json({ error: 'photoDataUrl is required' });
    return;
  }

  // Parse expected range from config or request
  const tolerances = config.ai.gaugeVerification.tolerances;
  const range = expectedRange || tolerances.airPressure; // Default to air pressure

  // Placeholder AI response — in production, this would call Gemini Vision API
  const mockReading = {
    checkpointId,
    measuredValue: parseFloat((range.min + Math.random() * (range.max - range.min)).toFixed(2)),
    unit: range.unit,
    withinTolerance: true,
    confidence: 0.82 + Math.random() * 0.15,
    analysisTimestamp: new Date().toISOString(),
    model: 'gemini-2.0-flash',
    note: 'AI gauge verification is in preview mode. Actual Gemini Vision API integration pending.',
  };

  mockReading.withinTolerance =
    mockReading.measuredValue >= range.min && mockReading.measuredValue <= range.max;

  res.json({
    success: true,
    verification: mockReading,
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found', availableRoutes: Object.values(config.routes) });
});

// ─── Error Handler ───────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ─── Server Boot ─────────────────────────────────────────────────

async function boot() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║         TPM Smart Verify — Backend Server             ║');
  console.log('║         KSPG Cockpit Integration Module               ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');

  // 1. Initialize MinIO bucket
  try {
    await ensureBucketExists();
  } catch (err: any) {
    console.warn(`⚠ MinIO connection warning: ${err.message}`);
    console.warn('  Server will start but photo uploads may fail.');
    console.warn('  Ensure MinIO is running on', config.storage.endpoint);
  }

  // 2. Initialize storage files
  getSubmissionsStore();
  getDeviationsStore();
  getStationStateStore();
  console.log('✓ JSON file storage initialized');

  // 3. Start HTTP server
  app.listen(config.server.port, config.server.host, () => {
    console.log('');
    console.log(`✓ Server running at http://${config.server.host}:${config.server.port}`);
    console.log(`  API prefix: ${config.server.apiPrefix}`);
    console.log(`  Health:     http://localhost:${config.server.port}${config.routes.health}`);
    console.log(`  Config:     http://localhost:${config.server.port}${config.routes.config}`);
    console.log(`  MinIO:      ${config.storage.endpoint} (bucket: ${config.storage.bucket})`);
    console.log('');
    console.log('  Ready for KSPG Cockpit integration ✓');
    console.log('');
  });
}

boot().catch((err) => {
  console.error('Fatal boot error:', err);
  process.exit(1);
});
