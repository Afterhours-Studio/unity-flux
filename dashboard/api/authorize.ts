import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getClient, corsHeaders } from './lib/oauth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v)
  if (req.method === 'OPTIONS') return res.status(204).end()

  // Accept both GET and POST
  const params = req.method === 'POST' ? req.body : req.query

  const clientId = params.client_id as string
  const redirectUri = params.redirect_uri as string
  const responseType = params.response_type as string
  const codeChallenge = params.code_challenge as string
  const codeChallengeMethod = params.code_challenge_method as string
  const state = params.state as string | undefined
  const scope = params.scope as string | undefined
  const resource = params.resource as string | undefined

  // Validate required params
  if (!clientId || !redirectUri || responseType !== 'code' || !codeChallenge) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing required parameters: client_id, redirect_uri, response_type=code, code_challenge',
    })
  }

  if (codeChallengeMethod && codeChallengeMethod !== 'S256') {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Only S256 code_challenge_method is supported',
    })
  }

  // Validate client
  const client = await getClient(clientId)
  if (!client) {
    return res.status(400).json({ error: 'invalid_client', error_description: 'Unknown client_id' })
  }

  // Validate redirect_uri
  if (!client.redirect_uris.includes(redirectUri)) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri not registered' })
  }

  // Redirect to SPA OAuth login page with all params
  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : (process.env.BASE_URL || 'https://flux.h1dr0n.org')
  const loginUrl = new URL(`${base}/oauth/login`)
  loginUrl.searchParams.set('client_id', clientId)
  loginUrl.searchParams.set('redirect_uri', redirectUri)
  loginUrl.searchParams.set('code_challenge', codeChallenge)
  if (state) loginUrl.searchParams.set('state', state)
  if (scope) loginUrl.searchParams.set('scope', scope)
  if (resource) loginUrl.searchParams.set('resource', resource)

  return res.redirect(302, loginUrl.toString())
}
