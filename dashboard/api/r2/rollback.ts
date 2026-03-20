/**
 * POST /api/r2/rollback
 * Update master_version.json pointer to an existing versioned config (for rollback).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { isR2Configured, updateMasterVersion } from '../lib/r2.js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify Supabase auth token
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' })
  }
  const token = authHeader.slice(7)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid auth token' })

  if (!isR2Configured()) {
    return res.status(503).json({ error: 'R2 not configured' })
  }

  const { projectSlug, projectName, environment, versionTag, tableCount, rowCount } = req.body

  if (!projectSlug || !environment || !versionTag) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    await updateMasterVersion({
      slug: projectSlug,
      name: projectName,
      environment,
      versionTag,
      tableCount: tableCount ?? 0,
      rowCount: rowCount ?? 0,
    })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('R2 rollback error:', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'R2 rollback failed' })
  }
}
