import type { VercelRequest, VercelResponse } from '@vercel/node'
import { corsHeaders, MCP_RESOURCE, ISSUER } from '../lib/oauth.js'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json')
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v)

  res.status(200).json({
    resource: MCP_RESOURCE,
    authorization_servers: [ISSUER],
    scopes_supported: ['mcp:tools'],
    bearer_methods_supported: ['header'],
  })
}
