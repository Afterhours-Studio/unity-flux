import { Router, type Request, type Response, type NextFunction } from 'express'
import type { DataStore } from '../store/data-store.js'
import type { Environment, SchemaField } from '../store/types.js'
import type { WebhookDispatcher } from './webhook-dispatcher.js'
import { createAuthMiddleware } from './auth-middleware.js'
import { generalLimiter, mutationLimiter, publishLimiter } from './rate-limit.js'

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>
const wrap = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next)
const param = (v: string | string[]): string => Array.isArray(v) ? v[0] : v

export function createApiRouter(store: DataStore, webhookDispatcher?: WebhookDispatcher): Router {
  const r = Router()
  r.use(createAuthMiddleware(store))
  r.use(generalLimiter)
  r.use((req, res, next) => {
    if (req.method !== 'GET') return mutationLimiter(req, res, next)
    next()
  })

  async function dispatchLatestActivity(projectId: string) {
    if (!webhookDispatcher) return
    const activities = await store.listActivity(projectId, 1)
    if (activities.length > 0) {
      webhookDispatcher.dispatch(activities[0]).catch(() => {})
    }
  }

  // ─── Projects ───────────────────────────────────────

  r.get('/projects', wrap(async (_req, res) => {
    res.json(await store.listProjects())
  }))

  r.get('/projects/:id', wrap(async (req, res) => {
    const p = await store.getProject(param(req.params.id))
    if (!p) return void res.status(404).json({ error: 'Project not found' })
    res.json(p)
  }))

  r.post('/projects', wrap(async (req, res) => {
    const { name, description = '' } = req.body
    if (!name) return void res.status(400).json({ error: 'name is required' })
    res.status(201).json(await store.createProject(name, description))
  }))

  r.patch('/projects/:id', wrap(async (req, res) => {
    res.json(await store.updateProject(param(req.params.id), req.body))
  }))

  r.delete('/projects/:id', wrap(async (req, res) => {
    await store.deleteProject(param(req.params.id))
    res.json({ ok: true })
  }))

  r.post('/projects/:id/api-key', wrap(async (req, res) => {
    res.json(await store.regenerateApiKey(param(req.params.id)))
  }))

  // ─── Tables (schemas) ──────────────────────────────

  r.get('/projects/:id/tables', wrap(async (req, res) => {
    res.json(await store.listSchemas(param(req.params.id)))
  }))

  r.post('/projects/:id/tables', wrap(async (req, res) => {
    const { name, fields = [], mode = 'data' } = req.body
    if (!name) return void res.status(400).json({ error: 'name is required' })
    const projectId = param(req.params.id)
    const schema = await store.createSchema(projectId, name, fields, mode)
    dispatchLatestActivity(projectId)
    res.status(201).json(schema)
  }))

  r.get('/tables/:id', wrap(async (req, res) => {
    const s = await store.getSchema(param(req.params.id))
    if (!s) return void res.status(404).json({ error: 'Table not found' })
    res.json(s)
  }))

  r.patch('/tables/:id', wrap(async (req, res) => {
    const { name, fields } = req.body
    if (name && !fields) {
      res.json(await store.renameSchema(param(req.params.id), name))
    } else {
      res.json(await store.updateSchema(param(req.params.id), req.body))
    }
  }))

  r.delete('/tables/:id', wrap(async (req, res) => {
    const schema = await store.getSchema(param(req.params.id))
    await store.deleteSchema(param(req.params.id))
    if (schema) dispatchLatestActivity(schema.projectId)
    res.json({ ok: true })
  }))

  // ─── Columns ────────────────────────────────────────

  r.post('/tables/:id/columns', wrap(async (req, res) => {
    const field = req.body as SchemaField
    if (!field.name || !field.type) return void res.status(400).json({ error: 'name and type required' })
    res.status(201).json(await store.addColumn(param(req.params.id), field))
  }))

  r.patch('/tables/:id/columns/:name', wrap(async (req, res) => {
    res.json(await store.updateColumn(param(req.params.id), param(req.params.name), req.body))
  }))

  r.delete('/tables/:id/columns/:name', wrap(async (req, res) => {
    res.json(await store.removeColumn(param(req.params.id), param(req.params.name)))
  }))

  // ─── Rows (entries) ─────────────────────────────────

  r.get('/tables/:id/rows', wrap(async (req, res) => {
    res.json(await store.listEntries(param(req.params.id)))
  }))

  r.post('/tables/:id/rows', wrap(async (req, res) => {
    const { data, environment = 'development' } = req.body
    if (!data) return void res.status(400).json({ error: 'data is required' })
    const schemaId = param(req.params.id)
    const entry = await store.createEntry(schemaId, data, environment as Environment)
    const schema = await store.getSchema(schemaId)
    if (schema) dispatchLatestActivity(schema.projectId)
    res.status(201).json(entry)
  }))

  r.get('/rows/:id', wrap(async (req, res) => {
    const e = await store.getEntry(param(req.params.id))
    if (!e) return void res.status(404).json({ error: 'Row not found' })
    res.json(e)
  }))

  r.patch('/rows/:id', wrap(async (req, res) => {
    const { data } = req.body
    if (!data) return void res.status(400).json({ error: 'data is required' })
    const entry = await store.updateEntry(param(req.params.id), data)
    const schema = await store.getSchema(entry.schemaId)
    if (schema) dispatchLatestActivity(schema.projectId)
    res.json(entry)
  }))

  r.delete('/rows/:id', wrap(async (req, res) => {
    const entry = await store.getEntry(param(req.params.id))
    await store.deleteEntry(param(req.params.id))
    if (entry) {
      const schema = await store.getSchema(entry.schemaId)
      if (schema) dispatchLatestActivity(schema.projectId)
    }
    res.json({ ok: true })
  }))

  // Bulk create rows
  r.post('/tables/:id/rows/bulk', mutationLimiter, wrap(async (req, res) => {
    const { rows, environment = 'development' } = req.body
    if (!Array.isArray(rows) || rows.length === 0) return void res.status(400).json({ error: 'rows array is required' })
    res.status(201).json(await store.createEntries(param(req.params.id), rows, environment as Environment))
  }))

  // Bulk delete rows
  r.post('/tables/:id/rows/bulk-delete', mutationLimiter, wrap(async (req, res) => {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) return void res.status(400).json({ error: 'ids array is required' })
    await store.deleteEntries(ids)
    res.json({ ok: true, deleted: ids.length })
  }))

  // ─── Versions ───────────────────────────────────────

  r.get('/projects/:id/versions', wrap(async (req, res) => {
    res.json(await store.listVersions(param(req.params.id)))
  }))

  // Version manifest (metadata + hashes, no data) for delta sync
  r.get('/projects/:id/versions/active', wrap(async (req, res) => {
    const env = (req.query.env as string) || 'development'
    const versions = await store.listVersions(param(req.params.id))
    const active = versions.find(v => v.environment === env && v.status === 'active')
    if (!active) return void res.status(404).json({ error: 'No active version' })
    // Return metadata without the full data payload
    const { data, ...manifest } = active
    res.json(manifest)
  }))

  // Single table data from a version
  r.get('/projects/:id/versions/:vid/tables/:name', wrap(async (req, res) => {
    const versions = await store.listVersions(param(req.params.id))
    const version = versions.find(v => v.id === param(req.params.vid))
    if (!version) return void res.status(404).json({ error: 'Version not found' })
    const tableData = version.data[param(req.params.name)]
    if (!tableData) return void res.status(404).json({ error: 'Table not found in version' })
    res.json(tableData)
  }))

  r.post('/projects/:id/publish', publishLimiter, wrap(async (req, res) => {
    const { environment } = req.body
    if (!environment) return void res.status(400).json({ error: 'environment is required' })
    const projectId = param(req.params.id)
    const version = await store.publishVersion(projectId, environment)
    dispatchLatestActivity(projectId)
    res.status(201).json(version)
  }))

  r.post('/versions/:id/promote', publishLimiter, wrap(async (req, res) => {
    const { targetEnvironment } = req.body
    if (!targetEnvironment) return void res.status(400).json({ error: 'targetEnvironment is required' })
    const version = await store.promoteVersion(param(req.params.id), targetEnvironment)
    dispatchLatestActivity(version.projectId)
    res.json(version)
  }))

  r.post('/versions/:id/rollback', publishLimiter, wrap(async (req, res) => {
    const versionId = param(req.params.id)
    // Find the version's projectId before rollback
    const projects = await store.listProjects()
    let projectId: string | undefined
    for (const p of projects) {
      const versions = await store.listVersions(p.id)
      if (versions.some(v => v.id === versionId)) { projectId = p.id; break }
    }
    await store.rollbackVersion(versionId)
    if (projectId) dispatchLatestActivity(projectId)
    res.json({ ok: true })
  }))

  r.delete('/versions/:id', wrap(async (req, res) => {
    await store.deleteVersion(param(req.params.id))
    res.json({ ok: true })
  }))

  r.post('/versions/compare', wrap(async (req, res) => {
    const { versionId1, versionId2 } = req.body
    if (!versionId1 || !versionId2) return void res.status(400).json({ error: 'versionId1 and versionId2 required' })
    res.json(await store.compareVersions(versionId1, versionId2))
  }))

  // ─── Activity ───────────────────────────────────────

  r.get('/projects/:id/activity', wrap(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
    res.json(await store.listActivity(param(req.params.id), limit))
  }))

  r.get('/activity/recent', wrap(async (_req, res) => {
    const projects = await store.listProjects()
    const allActivities: Array<Record<string, unknown>> = []
    for (const project of projects) {
      const activities = await store.listActivity(project.id, 10)
      allActivities.push(...activities.map(a => ({ ...a, projectName: project.name })))
    }
    allActivities.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime())
    res.json(allActivities.slice(0, 20))
  }))

  // ─── Webhooks ──────────────────────────────────────

  r.get('/projects/:id/webhooks', wrap(async (req, res) => {
    res.json(await store.listWebhooks(param(req.params.id)))
  }))

  r.post('/projects/:id/webhooks', mutationLimiter, wrap(async (req, res) => {
    const { url, secret, events } = req.body
    if (!url || !secret || !Array.isArray(events)) return void res.status(400).json({ error: 'url, secret, and events[] required' })
    res.status(201).json(await store.createWebhook(param(req.params.id), url, secret, events))
  }))

  r.delete('/webhooks/:id', wrap(async (req, res) => {
    await store.deleteWebhook(param(req.params.id))
    res.json({ ok: true })
  }))

  // ─── Search ────────────────────────────────────

  r.get('/search', wrap(async (req, res) => {
    const q = (req.query.q as string || '').toLowerCase().trim()
    if (!q) return void res.json({ projects: [], tables: [], rows: [] })

    const projects = await store.listProjects()
    const matchedProjects = projects.filter(p =>
      p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    ).slice(0, 5)

    const tables: Array<{ id: string; name: string; projectId: string; projectName: string; mode: string }> = []
    const rows: Array<{ id: string; schemaId: string; tableName: string; projectId: string; projectName: string; preview: string }> = []

    for (const project of projects) {
      const schemas = await store.listSchemas(project.id)
      for (const schema of schemas) {
        if (schema.name.toLowerCase().includes(q)) {
          tables.push({ id: schema.id, name: schema.name, projectId: project.id, projectName: project.name, mode: schema.mode })
        }
        if (tables.length + rows.length > 20) break

        const entries = await store.listEntries(schema.id)
        for (const entry of entries) {
          const match = Object.values(entry.data).some(v =>
            String(v).toLowerCase().includes(q)
          )
          if (match) {
            const preview = Object.entries(entry.data)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')
              .slice(0, 100)
            rows.push({ id: entry.id, schemaId: schema.id, tableName: schema.name, projectId: project.id, projectName: project.name, preview })
            if (rows.length >= 10) break
          }
        }
      }
      if (tables.length + rows.length > 20) break
    }

    res.json({
      projects: matchedProjects.map(p => ({ id: p.id, name: p.name, slug: p.slug })),
      tables: tables.slice(0, 10),
      rows: rows.slice(0, 10),
    })
  }))

  // ─── Codegen ────────────────────────────────────────

  r.get('/projects/:id/codegen', wrap(async (req, res) => {
    const ns = (req.query.namespace as string) || 'GameConfig'
    const schemas = await store.listSchemas(param(req.params.id))
    if (schemas.length === 0) return void res.status(404).json({ error: 'No tables found' })

    const typeMap: Record<string, string> = {
      string: 'string', integer: 'int', float: 'float', boolean: 'bool',
      enum: 'string', list: 'List<string>', color: 'Color', config: 'string',
    }
    const pascal = (s: string) => s.replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase()).replace(/^[a-z]/, c => c.toUpperCase())
    const camel = (s: string) => { const p = pascal(s); return p.charAt(0).toLowerCase() + p.slice(1) }

    const lines: string[] = [
      '// Auto-generated by Unity Flux', '// Do not edit manually.', '',
      'using System;', 'using System.Collections.Generic;', 'using UnityEngine;', '',
      `namespace ${ns}`, '{',
    ]

    const hasConfig = schemas.some(s => s.mode === 'config')
    if (hasConfig) {
      lines.push('    [Serializable]', '    public abstract class FluxConfigTable { }', '')
    }

    for (const schema of schemas) {
      const cn = pascal(schema.name)
      lines.push('    [Serializable]')
      lines.push(schema.mode === 'config' ? `    public class ${cn} : FluxConfigTable` : `    public class ${cn}`)
      lines.push('    {')
      for (const f of schema.fields) {
        const t = typeMap[f.type] || 'string'
        lines.push(`        [SerializeField] private ${t} _${camel(f.name)};`)
        lines.push(`        public ${t} ${pascal(f.name)} => _${camel(f.name)};`)
        lines.push('')
      }
      lines.push('    }', '')
    }

    lines.push('}', '')
    res.type('text/plain').send(lines.join('\n'))
  }))

  return r
}
