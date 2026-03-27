/**
 * GET /api/sdk?action=manifest&projectId=xxx&env=development
 * GET /api/sdk?action=config&projectId=xxx&env=development
 * GET /api/sdk?action=asset&projectId=xxx&env=development&key=filename
 * Authorization: Bearer <anonKey>
 *
 * Single endpoint for all SDK operations. Validates anonKey server-side.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { isR2Configured, generatePresignedUrl } from '../lib/r2.js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PRESIGN_EXPIRY_SEC = 300

async function validateAuth(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const projectId = req.query.projectId as string
  if (!projectId) {
    res.status(400).json({ error: 'Missing projectId' })
    return null
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <anonKey>' })
    return null
  }
  const anonKey = authHeader.slice(7)

  const { data: project } = await supabase
    .from('projects').select('anon_key').eq('id', projectId).single()
  if (!project || project.anon_key !== anonKey) {
    res.status(403).json({ error: 'Invalid credentials' })
    return null
  }

  return projectId
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Accept')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const action = req.query.action as string
  if (!action || !['manifest', 'config', 'asset'].includes(action)) {
    return res.status(400).json({ error: 'Missing or invalid action (manifest|config|asset)' })
  }

  const projectId = await validateAuth(req, res)
  if (!projectId) return // response already sent

  const env = req.query.env as string

  if (action === 'manifest') {
    if (!env) return res.status(400).json({ error: 'Missing env' })
    const { data: version } = await supabase
      .from('versions')
      .select('version_tag, environment, table_count, row_count, published_at')
      .eq('project_id', projectId)
      .eq('environment', env)
      .eq('status', 'active')
      .single()

    if (!version) return res.status(404).json({ error: `No active version for ${env}` })

    res.setHeader('Cache-Control', 'public, max-age=60')
    return res.status(200).json({
      version: version.version_tag,
      environment: version.environment,
      tableCount: version.table_count,
      rowCount: version.row_count,
      publishedAt: version.published_at,
    })
  }

  if (action === 'config') {
    if (!env) return res.status(400).json({ error: 'Missing env' })
    const { data: version } = await supabase
      .from('versions')
      .select('version_tag, environment, data, published_at')
      .eq('project_id', projectId)
      .eq('environment', env)
      .eq('status', 'active')
      .single()

    if (!version) return res.status(404).json({ error: `No active version for ${env}` })

    res.setHeader('Cache-Control', 'public, max-age=60')
    return res.status(200).json({
      version: version.version_tag,
      environment: version.environment,
      publishedAt: version.published_at,
      tables: version.data,
    })
  }

  if (action === 'asset') {
    const key = req.query.key as string
    if (!key) return res.status(400).json({ error: 'Missing key' })
    if (!isR2Configured()) return res.status(503).json({ error: 'R2 storage not configured' })

    try {
      const r2Key = env ? `${projectId}/${env}/${key}` : `${projectId}/${key}`
      const signedUrl = await generatePresignedUrl(r2Key, PRESIGN_EXPIRY_SEC)
      return res.status(200).json({ url: signedUrl, expiresIn: PRESIGN_EXPIRY_SEC })
    } catch (err) {
      console.error('Presign error:', err)
      return res.status(500).json({ error: 'Failed to generate access URL' })
    }
  }
}
