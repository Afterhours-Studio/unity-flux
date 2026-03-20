/**
 * Shared OAuth 2.1 library for MCP authentication.
 * JWT signing/verification, client store, authorization code store.
 */
import { SignJWT, jwtVerify } from 'jose'
import { createClient } from '@supabase/supabase-js'

// ─── Constants ───────────────────────────────────────────

const BASE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : (process.env.BASE_URL || 'https://flux.h1dr0n.org')

export const ISSUER = BASE_URL
export const MCP_RESOURCE = `${BASE_URL}/api/mcp`
export const AUTH_ENDPOINT = `${BASE_URL}/authorize`
export const TOKEN_ENDPOINT = `${BASE_URL}/token`
export const REGISTRATION_ENDPOINT = `${BASE_URL}/register`

// ─── Supabase (service role) ─────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── JWT ─────────────────────────────────────────────────

function getJwtSecret() {
  const secret = process.env.OAUTH_JWT_SECRET
  if (!secret) throw new Error('OAUTH_JWT_SECRET not configured')
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(userId: string, clientId: string, scopes: string[]): Promise<string> {
  return new SignJWT({ sub: userId, client_id: clientId, scopes })
    .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
    .setIssuer(ISSUER)
    .setAudience(MCP_RESOURCE)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(getJwtSecret())
}

export async function signRefreshToken(userId: string, clientId: string): Promise<string> {
  return new SignJWT({ sub: userId, client_id: clientId, typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret())
}

export interface TokenPayload {
  sub: string
  client_id: string
  scopes?: string[]
  typ?: string
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    issuer: ISSUER,
    audience: MCP_RESOURCE,
  })
  return payload as unknown as TokenPayload
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    issuer: ISSUER,
  })
  const p = payload as unknown as TokenPayload
  if (p.typ !== 'refresh') throw new Error('Not a refresh token')
  return p
}

// ─── Client Store ────────────────────────────────────────

export interface OAuthClient {
  client_id: string
  client_secret: string | null
  redirect_uris: string[]
  client_name: string | null
  token_endpoint_auth_method: string
  grant_types: string[]
  response_types: string[]
  scope: string | null
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const { data, error } = await supabase
    .from('oauth_clients')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error || !data) return null
  return {
    client_id: data.client_id,
    client_secret: data.client_secret,
    redirect_uris: data.redirect_uris as string[],
    client_name: data.client_name,
    token_endpoint_auth_method: data.token_endpoint_auth_method,
    grant_types: data.grant_types as string[],
    response_types: data.response_types as string[],
    scope: data.scope,
  }
}

export async function registerClient(metadata: {
  redirect_uris: string[]
  client_name?: string
  token_endpoint_auth_method?: string
  grant_types?: string[]
  response_types?: string[]
  scope?: string
}): Promise<OAuthClient & { client_id_issued_at: number }> {
  const clientId = crypto.randomUUID()
  const isPublic = (metadata.token_endpoint_auth_method ?? 'none') === 'none'
  const clientSecret = isPublic ? null : crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  const row = {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: metadata.redirect_uris,
    client_name: metadata.client_name ?? null,
    token_endpoint_auth_method: metadata.token_endpoint_auth_method ?? 'none',
    grant_types: metadata.grant_types ?? ['authorization_code', 'refresh_token'],
    response_types: metadata.response_types ?? ['code'],
    scope: metadata.scope ?? null,
  }

  const { error } = await supabase.from('oauth_clients').insert(row)
  if (error) throw error

  return { ...row, client_id_issued_at: now }
}

// ─── Authorization Code Store ────────────────────────────

export async function saveAuthorizationCode(params: {
  code: string
  clientId: string
  codeChallenge: string
  redirectUri: string
  userId: string
  scope?: string
  resource?: string
}): Promise<void> {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min
  const { error } = await supabase.from('oauth_codes').insert({
    code: params.code,
    client_id: params.clientId,
    code_challenge: params.codeChallenge,
    redirect_uri: params.redirectUri,
    user_id: params.userId,
    scope: params.scope ?? null,
    resource: params.resource ?? null,
    expires_at: expiresAt,
  })
  if (error) throw error
}

export interface StoredCode {
  code: string
  client_id: string
  code_challenge: string
  redirect_uri: string
  user_id: string
  scope: string | null
  resource: string | null
  expires_at: string
}

export async function getAndDeleteCode(code: string): Promise<StoredCode | null> {
  // Fetch
  const { data, error } = await supabase
    .from('oauth_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle()
  if (error || !data) return null

  // Delete (single use)
  await supabase.from('oauth_codes').delete().eq('code', code)

  // Check expiry
  if (new Date(data.expires_at) < new Date()) return null

  return data as StoredCode
}

// ─── PKCE ────────────────────────────────────────────────

export async function verifyPkce(codeVerifier: string, codeChallenge: string): Promise<boolean> {
  // S256: BASE64URL(SHA256(code_verifier)) === code_challenge
  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier))
  const base64url = Buffer.from(digest)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return base64url === codeChallenge
}

// ─── Supabase User Verification ──────────────────────────

export async function verifySupabaseToken(token: string): Promise<{ id: string; email: string } | null> {
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return { id: user.id, email: user.email ?? '' }
}

// ─── CORS Headers ────────────────────────────────────────

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}
