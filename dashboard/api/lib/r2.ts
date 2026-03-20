/**
 * R2 (S3-compatible) storage utility.
 * Uploads versioned config snapshots + master_version pointer.
 *
 * Security: R2 bucket is PRIVATE. All access goes through authenticated
 * Vercel API endpoints that generate short-lived presigned URLs.
 * Path: /{projectId}/{env}/config_{version}.json
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createHash } from 'crypto'

// ─── Config ──────────────────────────────────────────

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'flux-configs'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://cdn.h1dr0n.org'

export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY)
}

function getS3Client(): S3Client {
  if (!isR2Configured()) throw new Error('R2 not configured')
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  })
}

// ─── Hashing ─────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}

// ─── Upload Functions ────────────────────────────────

/**
 * Upload a versioned config snapshot + update master_version pointer.
 * Returns the CDN URL for the versioned config file.
 */
export async function uploadConfigVersion(params: {
  projectId: string
  environment: string
  versionTag: string
  snapshot: Record<string, Record<string, unknown>[]>
  tableCount: number
  rowCount: number
}): Promise<{ r2Key: string; hash: string }> {
  const { projectId, environment, versionTag, snapshot, tableCount, rowCount } = params
  const s3 = getS3Client()

  // Build the config payload
  const configPayload = JSON.stringify({
    version: versionTag,
    environment,
    publishedAt: new Date().toISOString(),
    tables: snapshot,
  }, null, 2)

  const hash = sha256(configPayload)
  const configKey = buildConfigKey(projectId, environment, versionTag)
  const masterKey = buildMasterKey(projectId, environment)

  // Upload immutable versioned config
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: configKey,
    Body: configPayload,
    ContentType: 'application/json',
    CacheControl: 'public, max-age=31536000, immutable',
  }))

  // Upload/update master_version pointer
  const masterPayload = JSON.stringify({
    version: versionTag,
    environment,
    hash,
    tableCount,
    rowCount,
    configKey,
    publishedAt: new Date().toISOString(),
  }, null, 2)

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: masterKey,
    Body: masterPayload,
    ContentType: 'application/json',
    CacheControl: 'public, max-age=60',
  }))

  return { r2Key: configKey, hash }
}

/**
 * Update master_version pointer only (for rollback).
 * Points master_version.json to an existing versioned config.
 */
export async function updateMasterVersion(params: {
  projectId: string
  environment: string
  versionTag: string
  tableCount: number
  rowCount: number
}): Promise<void> {
  const { projectId, environment, versionTag, tableCount, rowCount } = params
  const s3 = getS3Client()

  const configKey = buildConfigKey(projectId, environment, versionTag)
  const masterKey = buildMasterKey(projectId, environment)

  const masterPayload = JSON.stringify({
    version: versionTag,
    environment,
    configKey,
    tableCount,
    rowCount,
    rolledBackAt: new Date().toISOString(),
  }, null, 2)

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: masterKey,
    Body: masterPayload,
    ContentType: 'application/json',
    CacheControl: 'public, max-age=60',
  }))
}

/**
 * Generate a presigned GET URL for an R2 object.
 * The URL expires after the specified duration (default 5 minutes).
 * This allows authenticated access without making the bucket public.
 */
export async function generatePresignedUrl(
  key: string,
  expiresIn: number = 300,
): Promise<string> {
  const s3 = getS3Client()
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })
  return getSignedUrl(s3, command, { expiresIn })
}

/**
 * Build the R2 object key for a config version file.
 */
export function buildConfigKey(projectId: string, environment: string, versionTag: string): string {
  return `${projectId}/${environment}/config_${versionTag}.json`
}

/**
 * Build the R2 object key for the master version pointer.
 */
export function buildMasterKey(projectId: string, environment: string): string {
  return `${projectId}/${environment}/master_version.json`
}

