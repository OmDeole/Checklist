/**
 * MinIO / S3 Client — Object storage integration for TPM photo evidence.
 *
 * Uses @aws-sdk/client-s3 for standard S3-compatible operations against local MinIO.
 * Handles bucket creation, object put/get, signed URL generation, and metadata tagging.
 */

import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { loadMasterConfig, StorageConfig } from '../src/config/masterConfig.js';

// ─── Client Singleton ─────────────────────────────────────────────

let _client: S3Client | null = null;
let _storageConfig: StorageConfig | null = null;

function getStorageConfig(): StorageConfig {
  if (!_storageConfig) {
    _storageConfig = loadMasterConfig().storage;
  }
  return _storageConfig;
}

export function getS3Client(): S3Client {
  if (_client) return _client;

  const cfg = getStorageConfig();
  _client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
    },
    forcePathStyle: true, // Required for MinIO
  });

  return _client;
}

// ─── Bucket Management ───────────────────────────────────────────

/**
 * Ensure the evidence bucket exists. Creates it if not present.
 * Returns true if the bucket was created, false if it already existed.
 */
export async function ensureBucketExists(): Promise<boolean> {
  const client = getS3Client();
  const bucket = getStorageConfig().bucket;

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`✓ MinIO bucket "${bucket}" already exists`);
    return false;
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log(`Creating MinIO bucket "${bucket}"...`);
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`✓ MinIO bucket "${bucket}" created successfully`);
      return true;
    }
    throw err;
  }
}

// ─── Object Operations ───────────────────────────────────────────

export interface UploadResult {
  key: string;
  bucket: string;
  url: string;
  etag?: string;
}

export interface EvidenceMetadata {
  operatorId: string;
  stationId: string;
  minifactoryId: string;
  checkpointId: string;
  shift: string;
  capturedAt: string;
  [key: string]: string;
}

/**
 * Upload photo evidence to MinIO.
 * Accepts a base64 data URL or raw Buffer.
 */
export async function uploadEvidence(
  objectKey: string,
  data: Buffer | string,
  contentType: string,
  metadata: EvidenceMetadata
): Promise<UploadResult> {
  const client = getS3Client();
  const cfg = getStorageConfig();

  // Convert base64 data URL to Buffer if needed
  let buffer: Buffer;
  if (typeof data === 'string') {
    const base64Match = data.match(/^data:[^;]+;base64,(.+)$/);
    if (base64Match) {
      buffer = Buffer.from(base64Match[1], 'base64');
    } else {
      buffer = Buffer.from(data, 'base64');
    }
  } else {
    buffer = data;
  }

  // Prefix-qualified key
  const fullKey = `${cfg.objectPrefix}${objectKey}`;

  // Map metadata to S3 tags (x-amz-meta-*)
  const s3Metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    s3Metadata[key.replace(/([A-Z])/g, '-$1').toLowerCase()] = String(value);
  }

  const result = await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: fullKey,
      Body: buffer,
      ContentType: contentType,
      Metadata: s3Metadata,
    })
  );

  return {
    key: fullKey,
    bucket: cfg.bucket,
    url: `${cfg.publicBaseUrl}/${fullKey}`,
    etag: result.ETag?.replace(/"/g, ''),
  };
}

/**
 * Get a pre-signed or public URL for an object.
 * For local MinIO without expiration, returns the direct URL.
 */
export function getEvidenceUrl(objectKey: string): string {
  const cfg = getStorageConfig();
  return `${cfg.publicBaseUrl}/${objectKey}`;
}

/**
 * List evidence objects for a given prefix (e.g., by station or operator).
 */
export async function listEvidence(prefix: string, maxResults = 100) {
  const client = getS3Client();
  const cfg = getStorageConfig();

  const fullPrefix = `${cfg.objectPrefix}${prefix}`;

  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: cfg.bucket,
      Prefix: fullPrefix,
      MaxKeys: maxResults,
    })
  );

  return (result.Contents || []).map((obj) => ({
    key: obj.Key || '',
    size: obj.Size || 0,
    lastModified: obj.LastModified?.toISOString() || '',
    url: getEvidenceUrl(obj.Key || ''),
  }));
}

/**
 * Delete an evidence object from MinIO.
 */
export async function deleteEvidence(objectKey: string): Promise<void> {
  const client = getS3Client();
  const cfg = getStorageConfig();

  await client.send(
    new DeleteObjectCommand({
      Bucket: cfg.bucket,
      Key: objectKey,
    })
  );
}

/**
 * Check MinIO connectivity and bucket health.
 */
export async function checkMinioHealth(): Promise<{
  connected: boolean;
  bucket: string;
  error?: string;
}> {
  const cfg = getStorageConfig();
  try {
    const client = getS3Client();
    await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
    return { connected: true, bucket: cfg.bucket };
  } catch (err: any) {
    return {
      connected: false,
      bucket: cfg.bucket,
      error: err.message || 'MinIO unreachable',
    };
  }
}
