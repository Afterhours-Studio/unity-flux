import { Router, type Request, type Response, type NextFunction } from 'express'
import type { DataStore } from '../store/data-store.js'
import type { Environment, SchemaField } from '../store/types.js'

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>
const wrap = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next)
const param = (v: string | string[]): string => Array.isArray(v) ? v[0] : v

export function createApiRouter(store: DataStore): Router {
  const r = Router()

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
    res.status(201).json(await store.createSchema(param(req.params.id), name, fields, mode))
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
    await store.deleteSchema(param(req.params.id))
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
    res.status(201).json(await store.createEntry(param(req.params.id), data, environment as Environment))
  }))

  r.get('/rows/:id', wrap(async (req, res) => {
    const e = await store.getEntry(param(req.params.id))
    if (!e) return void res.status(404).json({ error: 'Row not found' })
    res.json(e)
  }))

  r.patch('/rows/:id', wrap(async (req, res) => {
    const { data } = req.body
    if (!data) return void res.status(400).json({ error: 'data is required' })
    res.json(await store.updateEntry(param(req.params.id), data))
  }))

  r.delete('/rows/:id', wrap(async (req, res) => {
    await store.deleteEntry(param(req.params.id))
    res.json({ ok: true })
  }))

  // ─── Versions ───────────────────────────────────────

  r.get('/projects/:id/versions', wrap(async (req, res) => {
    res.json(await store.listVersions(param(req.params.id)))
  }))

  r.post('/projects/:id/publish', wrap(async (req, res) => {
    const { environment } = req.body
    if (!environment) return void res.status(400).json({ error: 'environment is required' })
    res.status(201).json(await store.publishVersion(param(req.params.id), environment))
  }))

  r.post('/versions/:id/promote', wrap(async (req, res) => {
    const { targetEnvironment } = req.body
    if (!targetEnvironment) return void res.status(400).json({ error: 'targetEnvironment is required' })
    res.json(await store.promoteVersion(param(req.params.id), targetEnvironment))
  }))

  r.post('/versions/:id/rollback', wrap(async (req, res) => {
    await store.rollbackVersion(param(req.params.id))
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
