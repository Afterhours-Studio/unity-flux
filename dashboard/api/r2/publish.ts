/**
 * POST /api/r2/publish
 * Browser-side endpoint to upload a version snapshot to R2 CDN.
 * Called after the version is saved to Supabase DB.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { isR2Configured, uploadConfigVersion } from '../lib/r2.js'

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

  const { projectId, versionId, projectSlug, environment, versionTag, data, tableCount, rowCount } = req.body

  if (!projectId || !versionId || !projectSlug || !environment || !versionTag || !data) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const { r2Url, hash } = await uploadConfigVersion({
      slug: projectSlug,
      environment,
      versionTag,
      snapshot: data,
      tableCount: tableCount ?? 0,
      rowCount: rowCount ?? 0,
    })

    // Update version row with R2 URL
    await supabase.from('versions').update({ r2_url: r2Url }).eq('id', versionId)

    // Update project r2_bucket_url if not set
    const { data: project } = await supabase.from('projects').select('r2_bucket_url').eq('id', projectId).single()
    if (project && !project.r2_bucket_url) {
      const r2BucketUrl = process.env.R2_PUBLIC_URL || 'https://cdn.h1dr0n.org'
      await supabase.from('projects').update({ r2_bucket_url: r2BucketUrl }).eq('id', projectId)
    }

    return res.status(200).json({ r2Url, hash })
  } catch (err) {
    console.error('R2 publish error:', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'R2 upload failed' })
  }
}
