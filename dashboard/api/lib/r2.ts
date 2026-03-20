/**
 * R2 (S3-compatible) upload utility for CDN config delivery.
 * Uploads versioned config snapshots + master_version pointer.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
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
  slug: string
  name?: string
  environment: string
  versionTag: string
  snapshot: Record<string, Record<string, unknown>[]>
  tableCount: number
  rowCount: number
}): Promise<{ r2Url: string; hash: string }> {
  const { name, environment, versionTag, snapshot, tableCount, rowCount } = params
  const slug = name
    ? name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    : params.slug
  const s3 = getS3Client()

  // Build the config payload
  const configPayload = JSON.stringify({
    version: versionTag,
    environment,
    publishedAt: new Date().toISOString(),
    tables: snapshot,
  }, null, 2)

  const hash = sha256(configPayload)
  const configKey = `${slug}/${environment}/config_${versionTag}.json`
  const masterKey = `${slug}/${environment}/master_version.json`

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
    configUrl: `${R2_PUBLIC_URL}/${configKey}`,
    publishedAt: new Date().toISOString(),
  }, null, 2)

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: masterKey,
    Body: masterPayload,
    ContentType: 'application/json',
    CacheControl: 'public, max-age=60',
  }))

  const r2Url = `${R2_PUBLIC_URL}/${configKey}`
  return { r2Url, hash }
}

/**
 * Update master_version pointer only (for rollback).
 * Points master_version.json to an existing versioned config.
 */
export async function updateMasterVersion(params: {
  slug: string
  name?: string
  environment: string
  versionTag: string
  tableCount: number
  rowCount: number
}): Promise<void> {
  const { name, environment, versionTag, tableCount, rowCount } = params
  const slug = name
    ? name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    : params.slug
  const s3 = getS3Client()

  const configKey = `${slug}/${environment}/config_${versionTag}.json`
  const masterKey = `${slug}/${environment}/master_version.json`

  const masterPayload = JSON.stringify({
    version: versionTag,
    environment,
    configUrl: `${R2_PUBLIC_URL}/${configKey}`,
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
 * Get the public CDN URL for a project's environment.
 */
export function getCdnUrl(slug: string, environment: string, name?: string): string {
  const cdnSlug = name
    ? name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    : slug
  return `${R2_PUBLIC_URL}/${cdnSlug}/${environment}/master_version.json`
}

/**
 * Get the public URL base.
 */
export function getR2PublicUrl(): string {
  return R2_PUBLIC_URL
}
