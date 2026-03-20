import type { VercelRequest, VercelResponse } from '@vercel/node'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import * as db from './lib/supabase-server.js'
import { verifyAccessToken, ISSUER } from './lib/oauth.js'
import { isR2Configured } from './lib/r2.js'

const MCP_API_KEY = process.env.FLUX_MCP_API_KEY

async function checkAuth(req: VercelRequest): Promise<boolean> {
  const auth = req.headers.authorization
  if (!auth) return false
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth

  // Try OAuth JWT first
  try {
    await verifyAccessToken(token)
    return true
  } catch {
    // Fall through to legacy API key
  }

  // Legacy: static API key
  if (MCP_API_KEY && token === MCP_API_KEY) return true

  return false
}

function registerTools(server: McpServer) {
  const tool = (
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    handler: (params: Record<string, unknown>) => Promise<unknown>,
  ) => {
    server.tool(name, description, schema, async (params) => {
      const result = await handler(params as Record<string, unknown>)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    })
  }

  // ─── Projects ───────────────────────────────────────
  tool('list_projects', 'List all projects', {}, () => db.listProjects())
  tool('get_project', 'Get a project by ID', { projectId: z.string() }, ({ projectId }) => db.getProject(projectId as string))
  tool('create_project', 'Create a new project', { name: z.string(), description: z.string().optional().default('') },
    ({ name, description }) => db.createProject(name as string, (description as string) ?? ''))
  tool('update_project', 'Update a project', {
    projectId: z.string(), name: z.string().optional(), description: z.string().optional(),
    supabaseUrl: z.string().optional(), r2BucketUrl: z.string().optional(),
    environment: z.enum(['development', 'staging', 'production']).optional(),
  }, ({ projectId, ...updates }) => db.updateProject(projectId as string, updates))
  tool('delete_project', 'Delete a project and all its data', { projectId: z.string() },
    async ({ projectId }) => { await db.deleteProject(projectId as string); return { ok: true } })

  // ─── Tables ─────────────────────────────────────────
  tool('list_tables', 'List tables in a project', { projectId: z.string() }, ({ projectId }) => db.listSchemas(projectId as string))
  tool('get_table', 'Get a table by ID', { tableId: z.string() }, ({ tableId }) => db.getSchema(tableId as string))
  tool('create_table', 'Create a new table', {
    projectId: z.string(), name: z.string(),
    mode: z.enum(['data', 'config']).optional().default('data'),
    columns: z.array(z.object({
      name: z.string(), type: z.enum(['string', 'integer', 'float', 'boolean', 'enum', 'list', 'color', 'config']),
      required: z.boolean().optional().default(false), values: z.array(z.string()).optional(), configRef: z.string().optional(),
    })).optional().default([]),
  }, ({ projectId, name, columns, mode }) => db.createSchema(projectId as string, name as string, columns as any[] ?? [], (mode as any) ?? 'data'))
  tool('rename_table', 'Rename a table', { tableId: z.string(), name: z.string() },
    ({ tableId, name }) => db.renameSchema(tableId as string, name as string))
  tool('delete_table', 'Delete a table and all its rows', { tableId: z.string() },
    async ({ tableId }) => { await db.deleteSchema(tableId as string); return { ok: true } })

  // ─── Columns ────────────────────────────────────────
  const columnSchema = z.object({
    name: z.string(), type: z.enum(['string', 'integer', 'float', 'boolean', 'enum', 'list', 'color', 'config']),
    required: z.boolean().optional().default(false), values: z.array(z.string()).optional(), configRef: z.string().optional(),
  })

  tool('add_column', 'Add a column to a table', {
    tableId: z.string(), name: z.string(),
    type: z.enum(['string', 'integer', 'float', 'boolean', 'enum', 'list', 'color', 'config']),
    required: z.boolean().optional().default(false), values: z.array(z.string()).optional(), configRef: z.string().optional(),
  }, ({ tableId, name, type, required, values, configRef }) =>
    db.addColumn(tableId as string, { name: name as string, type: type as string, required: (required as boolean) ?? false, ...(values ? { values: values as string[] } : {}), ...(configRef ? { configRef: configRef as string } : {}) }))
  tool('add_columns', 'Add multiple columns to a table at once', {
    tableId: z.string(),
    columns: z.array(columnSchema).min(1),
  }, ({ tableId, columns }) =>
    db.addColumns(tableId as string, columns as any[]))
  tool('update_column', 'Update a column in a table', {
    tableId: z.string(), columnName: z.string(),
    type: z.enum(['string', 'integer', 'float', 'boolean', 'enum', 'list', 'color', 'config']).optional(),
    required: z.boolean().optional(), values: z.array(z.string()).optional(), configRef: z.string().optional(),
  }, ({ tableId, columnName, ...updates }) => db.updateColumn(tableId as string, columnName as string, updates))
  tool('remove_column', 'Remove a column from a table', { tableId: z.string(), columnName: z.string() },
    ({ tableId, columnName }) => db.removeColumn(tableId as string, columnName as string))

  // ─── Rows ───────────────────────────────────────────
  tool('list_rows', 'List rows in a table', { tableId: z.string() }, ({ tableId }) => db.listEntries(tableId as string))
  tool('get_row', 'Get a row by ID', { rowId: z.string() }, ({ rowId }) => db.getEntry(rowId as string))
  tool('add_row', 'Add a row to a table', {
    tableId: z.string(), data: z.record(z.string(), z.unknown()),
    environment: z.enum(['development', 'staging', 'production']).optional().default('development'),
  }, ({ tableId, data, environment }) => db.createEntry(tableId as string, data as Record<string, unknown>, environment as any))
  tool('add_rows', 'Add multiple rows to a table at once', {
    tableId: z.string(),
    rows: z.array(z.record(z.string(), z.unknown())).min(1),
    environment: z.enum(['development', 'staging', 'production']).optional().default('development'),
  }, ({ tableId, rows, environment }) => db.createEntries(tableId as string, rows as Record<string, unknown>[], environment as any))
  tool('update_row', 'Update a row', { rowId: z.string(), data: z.record(z.string(), z.unknown()) },
    ({ rowId, data }) => db.updateEntry(rowId as string, data as Record<string, unknown>))
  tool('update_rows', 'Update multiple rows at once', {
    rows: z.array(z.object({ rowId: z.string(), data: z.record(z.string(), z.unknown()) })).min(1),
  }, ({ rows }) => db.updateEntries((rows as any[]).map(r => ({ id: r.rowId, data: r.data }))))
  tool('delete_row', 'Delete a row', { rowId: z.string() },
    async ({ rowId }) => { await db.deleteEntry(rowId as string); return { ok: true } })

  // ─── Versions ───────────────────────────────────────
  tool('list_versions', 'List published versions', { projectId: z.string() }, ({ projectId }) => db.listVersions(projectId as string))
  tool('publish_version', 'Publish a new version', {
    projectId: z.string(), environment: z.enum(['development', 'staging', 'production']),
  }, ({ projectId, environment }) => db.publishVersion(projectId as string, environment as any))
  tool('promote_version', 'Promote a version to another environment', {
    versionId: z.string(), targetEnvironment: z.enum(['development', 'staging', 'production']),
  }, ({ versionId, targetEnvironment }) => db.promoteVersion(versionId as string, targetEnvironment as any))
  tool('rollback_version', 'Rollback to a previous version', { versionId: z.string() },
    async ({ versionId }) => { await db.rollbackVersion(versionId as string); return { ok: true } })
  tool('delete_version', 'Delete a version', { versionId: z.string() },
    async ({ versionId }) => { await db.deleteVersion(versionId as string); return { ok: true } })
  tool('compare_versions', 'Compare two versions', { versionId1: z.string(), versionId2: z.string() },
    ({ versionId1, versionId2 }) => db.compareVersions(versionId1 as string, versionId2 as string))

  // ─── Activity ───────────────────────────────────────
  tool('list_activity', 'List recent activity for a project', {
    projectId: z.string(), limit: z.number().optional(),
  }, ({ projectId, limit }) => db.listActivity(projectId as string, limit as number | undefined))

  // ─── Live Ops Events ───────────────────────────────
  tool('list_live_ops_events', 'List all live ops events for a project', {
    projectId: z.string(),
  }, ({ projectId }) => db.listLiveOpsEvents(projectId as string))

  tool('create_live_ops_event', 'Create a live ops event (flash sale, tournament, maintenance, etc.)', {
    projectId: z.string(),
    name: z.string(),
    type: z.enum(['daily_login', 'flash_sale', 'limited_shop', 'tournament', 'season_pass', 'maintenance', 'world_boss', 'custom']),
    status: z.enum(['draft', 'scheduled', 'live', 'ended', 'cancelled']).optional().default('draft'),
    description: z.string().optional().default(''),
    startAt: z.string().optional().default(''),
    endAt: z.string().optional().default(''),
    color: z.string().optional().default('#3b82f6'),
    config: z.record(z.unknown()).optional().default({}),
    recurring: z.string().nullable().optional().default(null),
  }, ({ projectId, ...event }) => db.createLiveOpsEvent(projectId as string, event as Parameters<typeof db.createLiveOpsEvent>[1]))

  tool('update_live_ops_event', 'Update a live ops event', {
    eventId: z.string(),
    name: z.string().optional(), description: z.string().optional(),
    status: z.enum(['draft', 'scheduled', 'live', 'ended', 'cancelled']).optional(),
    startAt: z.string().optional(), endAt: z.string().optional(),
    color: z.string().optional(), config: z.record(z.unknown()).optional(),
    recurring: z.string().nullable().optional(),
  }, ({ eventId, ...updates }) => db.updateLiveOpsEvent(eventId as string, updates as Parameters<typeof db.updateLiveOpsEvent>[1]))

  tool('delete_live_ops_event', 'Delete a live ops event', {
    eventId: z.string(),
  }, ({ eventId }) => db.deleteLiveOpsEvent(eventId as string))

  // ─── Battle Pass Tiers ────────────────────────────
  tool('list_battle_pass_tiers', 'List battle pass tiers for a live ops event', {
    eventId: z.string(),
  }, ({ eventId }) => db.listBattlePassTiers(eventId as string))

  tool('create_battle_pass_tier', 'Create a battle pass tier', {
    eventId: z.string(),
    tier: z.number().int(),
    xpRequired: z.number().int(),
    freeReward: z.string().optional().default(''),
    premiumReward: z.string().optional().default(''),
  }, ({ eventId, ...tier }) => db.createBattlePassTier(eventId as string, tier as Parameters<typeof db.createBattlePassTier>[1]))

  tool('update_battle_pass_tier', 'Update a battle pass tier', {
    tierId: z.string(),
    tier: z.number().int().optional(),
    xpRequired: z.number().int().optional(),
    freeReward: z.string().optional(),
    premiumReward: z.string().optional(),
  }, ({ tierId, ...updates }) => db.updateBattlePassTier(tierId as string, updates as Parameters<typeof db.updateBattlePassTier>[1]))

  tool('delete_battle_pass_tier', 'Delete a battle pass tier', {
    tierId: z.string(),
  }, ({ tierId }) => db.deleteBattlePassTier(tierId as string))

  // ─── Formulas ─────────────────────────────────────
  tool('list_formulas', 'List all formulas for a project', {
    projectId: z.string(),
  }, ({ projectId }) => db.listFormulas(projectId as string))

  tool('create_formula', 'Create a math formula (e.g. damage = base * level * multiplier)', {
    projectId: z.string(),
    name: z.string(),
    expression: z.string(),
    description: z.string().optional().default(''),
    variables: z.array(z.object({
      name: z.string(), type: z.enum(['int', 'float']),
      defaultValue: z.number(), description: z.string().optional().default(''),
    })).optional().default([]),
    outputMode: z.enum(['method', 'lookup']).optional().default('method'),
    previewInputs: z.record(z.array(z.number())).optional().default({}),
  }, ({ projectId, ...formula }) => db.createFormula(projectId as string, formula as Parameters<typeof db.createFormula>[1]))

  tool('update_formula', 'Update a formula', {
    formulaId: z.string(),
    name: z.string().optional(), expression: z.string().optional(),
    description: z.string().optional(),
    variables: z.array(z.object({
      name: z.string(), type: z.enum(['int', 'float']),
      defaultValue: z.number(), description: z.string().optional().default(''),
    })).optional(),
    outputMode: z.enum(['method', 'lookup']).optional(),
    previewInputs: z.record(z.array(z.number())).optional(),
  }, ({ formulaId, ...updates }) => db.updateFormula(formulaId as string, updates as Parameters<typeof db.updateFormula>[1]))

  tool('delete_formula', 'Delete a formula', {
    formulaId: z.string(),
  }, ({ formulaId }) => db.deleteFormula(formulaId as string))

  // ─── CDN ─────────────────────────────────────────
  tool('get_cdn_url', 'Get the SDK API endpoints for a project. Returns authenticated endpoints for Unity SDK to fetch configs.', {
    projectId: z.string(),
  }, async ({ projectId }) => {
    const project = await db.getProject(projectId as string)
    if (!project) throw new Error(`Project not found: ${projectId}`)
    return {
      r2Configured: isR2Configured(),
      sdkEndpoints: {
        manifest: `/api/sdk/manifest?projectId=${projectId}&env={environment}`,
        config: `/api/sdk/config?projectId=${projectId}&env={environment}`,
        asset: `/api/sdk/asset?projectId=${projectId}&env={environment}&key={filename}`,
      },
      note: 'All SDK endpoints require Authorization: Bearer <anonKey> header',
    }
  })

  // ─── Codegen ────────────────────────────────────────
  tool('generate_csharp_code', 'Generate C# classes for Unity SDK. Config tables generate fields from rows; data tables generate fields from columns.', {
    projectId: z.string(),
    namespace: z.string().optional().default('GameConfig'),
  }, async ({ projectId, namespace }) => {
      const schemas = await db.listSchemas(projectId as string)
      if (schemas.length === 0) return { code: '// No tables found' }
      const ns = (namespace as string) || 'GameConfig'

      // ── Helpers ──
      function toPascalCase(str: string): string {
        return str
          .replace(/[^a-zA-Z0-9]/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
          .trim().split(/\s+/).filter(Boolean)
          .map((w, _i, arr) => {
            const isAllCaps = w === w.toUpperCase() && w.length > 1
            if (isAllCaps) {
              if (arr.every(x => x === x.toUpperCase())) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
              return w
            }
            return w.charAt(0).toUpperCase() + w.slice(1)
          }).join('')
      }
      function toCamelCase(s: string): string { const p = toPascalCase(s); return p.charAt(0).toLowerCase() + p.slice(1) }
      function enumMemberName(v: string): string { const c = v.replace(/[^a-zA-Z0-9_]/g, ''); return c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Unknown' }

      interface Field { name: string; type: string; required: boolean; values?: string[]; configRef?: string }
      function csType(field: Field, className: string): string {
        switch (field.type) {
          case 'string': return 'string'; case 'integer': return 'int'; case 'float': return 'float'
          case 'boolean': return 'bool'; case 'enum': return `${className}_${toPascalCase(field.name)}`
          case 'list': return 'string[]'; case 'color': return 'Color'; case 'config': return 'string'
          default: return 'string'
        }
      }
      function configTypeToCSharp(t: string): string {
        switch (t.toLowerCase()) {
          case 'int': case 'integer': return 'int'; case 'float': return 'float'
          case 'bool': case 'boolean': return 'bool'; case 'list': return 'string[]'
          case 'enum': return 'string'; case 'color': return 'Color'
          case 'string': default: return 'string'
        }
      }
      function formatValue(csT: string, val: unknown): string {
        if (val == null || val === '') {
          switch (csT) { case 'int': return '0'; case 'float': return '0f'; case 'bool': return 'false'; case 'string[]': return 'new string[0]'; default: return '""' }
        }
        const s = String(val)
        switch (csT) {
          case 'int': return String(parseInt(s) || 0)
          case 'float': { const n = parseFloat(s) || 0; const r = String(n); return r.includes('.') ? `${r}f` : `${r}.0f` }
          case 'bool': return s.toLowerCase() === 'true' ? 'true' : 'false'
          case 'string[]': { const items = s.split(',').map(x => x.trim()).filter(Boolean); return items.length ? `new string[] { ${items.map(x => `"${x}"`).join(', ')} }` : 'new string[0]' }
          default: return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
        }
      }

      const indent = '    '
      let body = ''

      for (const schema of schemas) {
        const className = toPascalCase(schema.name)

        if (schema.mode === 'config') {
          // Config table: generate fields from ROWS
          const entries = await db.listEntries(schema.id)
          const configField = schema.fields.find((f: Field) => f.type === 'config')
          const valueColName = configField?.configRef
          const keyField = schema.fields.find((f: Field) =>
            f.name !== configField?.name && f.name !== valueColName && !f.name.toLowerCase().includes('description'))

          body += `${indent}[Serializable]\n${indent}public class ${className}\n${indent}{\n`
          if (!keyField || !configField || !valueColName || entries.length === 0) {
            body += `${indent}${indent}// No config entries found\n`
          } else {
            for (const e of entries) {
              const paramName = String(e.data[keyField.name] ?? '')
              if (!paramName) continue
              const configType = String(e.data[configField.name] ?? 'string')
              const value = e.data[valueColName]
              const ct = configTypeToCSharp(configType)
              const priv = toCamelCase(paramName)
              const pub = toPascalCase(paramName)
              body += `${indent}${indent}[SerializeField] private ${ct} ${priv} = ${formatValue(ct, value)};\n`
              body += `${indent}${indent}public ${ct} ${pub} => ${priv};\n\n`
            }
          }
          body += `${indent}}\n\n`
          continue
        }

        // Data table: generate enum definitions
        for (const field of schema.fields) {
          if (field.type === 'enum' && field.values?.length) {
            const enumName = `${className}_${toPascalCase(field.name)}`
            const seen = new Set<string>()
            const members: string[] = []
            for (const v of field.values) { const n = enumMemberName(v); if (!seen.has(n)) { seen.add(n); members.push(n) } }
            body += `${indent}public enum ${enumName}\n${indent}{\n${members.map(m => `${indent}${indent}${m}`).join(',\n')}\n${indent}}\n\n`
          }
        }

        // Data table: generate class
        body += `${indent}[Serializable]\n${indent}public class ${className}\n${indent}{\n`
        for (const field of schema.fields) {
          const ct = csType(field, className)
          const priv = toCamelCase(field.name)
          const pub = toPascalCase(field.name)
          body += `${indent}${indent}[SerializeField] private ${ct} ${priv};\n`
          body += `${indent}${indent}public ${ct} ${pub} => ${priv};\n\n`
        }
        body += `${indent}}\n\n`
      }

      // FluxLoader utility
      body += `${indent}public static class FluxLoader\n${indent}{\n`
      body += `${indent}${indent}public static T Load<T>(string json) where T : class\n${indent}${indent}{\n`
      body += `${indent}${indent}${indent}return JsonUtility.FromJson<T>(json);\n${indent}${indent}}\n\n`
      body += `${indent}${indent}public static List<T> LoadList<T>(string json) where T : class\n${indent}${indent}{\n`
      body += `${indent}${indent}${indent}var wrapper = JsonUtility.FromJson<ListWrapper<T>>(json);\n`
      body += `${indent}${indent}${indent}return wrapper.items;\n${indent}${indent}}\n\n`
      body += `${indent}${indent}[Serializable]\n${indent}${indent}private class ListWrapper<T>\n${indent}${indent}{\n`
      body += `${indent}${indent}${indent}public List<T> items;\n${indent}${indent}}\n${indent}}\n`

      const header = '// Auto-generated by Unity Flux \u2014 do not edit manually\n'
        + 'using System;\nusing System.Collections.Generic;\nusing UnityEngine;\n'
      const code = `${header}\nnamespace ${ns}\n{\n${body}}\n`
      return { code }
    })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ name: 'unity-flux', version: '0.1.0', status: 'ok' })
  }

  if (req.method === 'DELETE') {
    // MCP session cleanup — just acknowledge
    return res.status(200).json({ ok: true })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST for MCP.' })
  }

  const authed = await checkAuth(req)
  if (!authed) {
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${ISSUER}/.well-known/oauth-protected-resource"`)
    return res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Unauthorized' },
      id: null,
    })
  }

  try {
    const server = new McpServer({ name: 'unity-flux', version: '0.1.0' })
    registerTools(server)

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => transport.close())
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (err) {
    console.error('MCP error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' })
    }
  }
}
