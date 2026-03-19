import type { VercelRequest, VercelResponse } from '@vercel/node'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import * as db from './lib/supabase-server.js'
import { verifyAccessToken } from './lib/oauth.js'

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
  tool('add_column', 'Add a column to a table', {
    tableId: z.string(), name: z.string(),
    type: z.enum(['string', 'integer', 'float', 'boolean', 'enum', 'list', 'color', 'config']),
    required: z.boolean().optional().default(false), values: z.array(z.string()).optional(), configRef: z.string().optional(),
  }, ({ tableId, name, type, required, values, configRef }) =>
    db.addColumn(tableId as string, { name: name as string, type: type as string, required: (required as boolean) ?? false, ...(values ? { values: values as string[] } : {}), ...(configRef ? { configRef: configRef as string } : {}) }))
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
  tool('update_row', 'Update a row', { rowId: z.string(), data: z.record(z.string(), z.unknown()) },
    ({ rowId, data }) => db.updateEntry(rowId as string, data as Record<string, unknown>))
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

  // ─── Codegen ────────────────────────────────────────
  tool('generate_csharp_code', 'Generate C# classes for Unity SDK', { projectId: z.string() },
    async ({ projectId }) => {
      const schemas = await db.listSchemas(projectId as string)
      if (schemas.length === 0) return { code: '// No tables found' }
      let code = '// Auto-generated by Unity Flux\nusing UnityEngine;\nusing System;\n\n'
      for (const schema of schemas) {
        code += `[Serializable]\npublic class ${schema.name}\n{\n`
        for (const field of schema.fields) {
          const csType = ({ string: 'string', integer: 'int', float: 'float', boolean: 'bool', enum: 'string', list: 'string[]', color: 'string', config: 'string' } as Record<string, string>)[field.type] ?? 'string'
          const fieldName = '_' + field.name.charAt(0).toLowerCase() + field.name.slice(1)
          const propName = field.name.charAt(0).toUpperCase() + field.name.slice(1)
          code += `    [SerializeField] private ${csType} ${fieldName};\n    public ${csType} ${propName} => ${fieldName};\n\n`
        }
        code += '}\n\n'
      }
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
    res.setHeader('WWW-Authenticate', 'Bearer resource_metadata="https://flux.h1dr0n.org/.well-known/oauth-protected-resource"')
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
