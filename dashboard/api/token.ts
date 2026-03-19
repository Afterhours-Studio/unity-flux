import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getAndDeleteCode, getClient, verifyPkce,
  signAccessToken, signRefreshToken, verifyRefreshToken,
  corsHeaders,
} from './lib/oauth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')

  try {
    // Parse form-urlencoded or JSON body
    const body = req.body ?? {}
    const grantType = body.grant_type

    if (grantType === 'authorization_code') {
      return await handleAuthorizationCode(body, res)
    } else if (grantType === 'refresh_token') {
      return await handleRefreshToken(body, res)
    } else {
      return res.status(400).json({ error: 'unsupported_grant_type' })
    }
  } catch (err) {
    console.error('Token error:', err)
    return res.status(500).json({ error: 'server_error' })
  }
}

async function handleAuthorizationCode(body: Record<string, unknown>, res: VercelResponse) {
  const code = body.code as string
  const codeVerifier = body.code_verifier as string
  const clientId = body.client_id as string
  const redirectUri = body.redirect_uri as string

  if (!code || !codeVerifier || !clientId) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Missing code, code_verifier, or client_id' })
  }

  // Verify client exists
  const client = await getClient(clientId)
  if (!client) {
    return res.status(401).json({ error: 'invalid_client' })
  }

  // Authenticate confidential clients
  if (client.token_endpoint_auth_method !== 'none') {
    const clientSecret = body.client_secret as string
    if (client.client_secret !== clientSecret) {
      return res.status(401).json({ error: 'invalid_client', error_description: 'Bad client_secret' })
    }
  }

  // Get and consume code (single use)
  const stored = await getAndDeleteCode(code)
  if (!stored) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' })
  }

  // Verify code belongs to this client
  if (stored.client_id !== clientId) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Code was issued to a different client' })
  }

  // Verify redirect_uri matches
  if (redirectUri && stored.redirect_uri !== redirectUri) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' })
  }

  // Verify PKCE
  const pkceValid = await verifyPkce(codeVerifier, stored.code_challenge)
  if (!pkceValid) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' })
  }

  // Issue tokens
  const scopes = stored.scope ? stored.scope.split(' ') : ['mcp:tools']
  const accessToken = await signAccessToken(stored.user_id, clientId, scopes)
  const refreshToken = await signRefreshToken(stored.user_id, clientId)

  return res.status(200).json({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: scopes.join(' '),
  })
}

async function handleRefreshToken(body: Record<string, unknown>, res: VercelResponse) {
  const refreshTokenStr = body.refresh_token as string
  const clientId = body.client_id as string

  if (!refreshTokenStr || !clientId) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Missing refresh_token or client_id' })
  }

  // Verify client
  const client = await getClient(clientId)
  if (!client) {
    return res.status(401).json({ error: 'invalid_client' })
  }

  // Verify refresh token
  let payload
  try {
    payload = await verifyRefreshToken(refreshTokenStr)
  } catch {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired refresh token' })
  }

  if (payload.client_id !== clientId) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Token was issued to a different client' })
  }

  // Issue new tokens
  const scopes = ['mcp:tools']
  const accessToken = await signAccessToken(payload.sub, clientId, scopes)
  const newRefreshToken = await signRefreshToken(payload.sub, clientId)

  return res.status(200).json({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: newRefreshToken,
    scope: scopes.join(' '),
  })
}
