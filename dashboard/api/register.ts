import type { VercelRequest, VercelResponse } from '@vercel/node'
import { registerClient, corsHeaders } from './lib/oauth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  try {
    const body = req.body ?? {}
    const redirectUris = body.redirect_uris
    if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
      return res.status(400).json({ error: 'invalid_client_metadata', error_description: 'redirect_uris is required' })
    }

    const client = await registerClient({
      redirect_uris: redirectUris,
      client_name: body.client_name,
      token_endpoint_auth_method: body.token_endpoint_auth_method,
      grant_types: body.grant_types,
      response_types: body.response_types,
      scope: body.scope,
    })

    return res.status(201).json({
      client_id: client.client_id,
      client_secret: client.client_secret,
      client_id_issued_at: client.client_id_issued_at,
      redirect_uris: client.redirect_uris,
      client_name: client.client_name,
      token_endpoint_auth_method: client.token_endpoint_auth_method,
      grant_types: client.grant_types,
      response_types: client.response_types,
    })
  } catch (err) {
    console.error('Registration error:', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
