import type { VercelRequest, VercelResponse } from '@vercel/node'
import { corsHeaders, ISSUER, AUTH_ENDPOINT, TOKEN_ENDPOINT, REGISTRATION_ENDPOINT } from '../lib/oauth.js'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json')
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v)

  res.status(200).json({
    issuer: ISSUER,
    authorization_endpoint: AUTH_ENDPOINT,
    token_endpoint: TOKEN_ENDPOINT,
    registration_endpoint: REGISTRATION_ENDPOINT,
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    scopes_supported: ['mcp:tools'],
  })
}
