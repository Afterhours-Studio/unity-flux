import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifySupabaseToken, saveAuthorizationCode, getClient, corsHeaders } from '../lib/oauth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v)
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  try {
    const { supabase_token, client_id, redirect_uri, code_challenge, state, scope, resource } = req.body ?? {}

    if (!supabase_token || !client_id || !redirect_uri || !code_challenge) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing required fields' })
    }

    // Verify Supabase token → get user
    const user = await verifySupabaseToken(supabase_token)
    if (!user) {
      return res.status(401).json({ error: 'invalid_token', error_description: 'Invalid or expired Supabase token' })
    }

    // Verify client
    const client = await getClient(client_id)
    if (!client) {
      return res.status(400).json({ error: 'invalid_client' })
    }

    if (!client.redirect_uris.includes(redirect_uri)) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri not registered' })
    }

    // Generate authorization code
    const code = crypto.randomUUID()
    await saveAuthorizationCode({
      code,
      clientId: client_id,
      codeChallenge: code_challenge,
      redirectUri: redirect_uri,
      userId: user.id,
      scope,
      resource,
    })

    // Build redirect URL
    const redirectUrl = new URL(redirect_uri)
    redirectUrl.searchParams.set('code', code)
    if (state) redirectUrl.searchParams.set('state', state)

    return res.status(200).json({ redirect_url: redirectUrl.toString() })
  } catch (err) {
    console.error('OAuth callback error:', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
