import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { JsonStore } from '../store/json-store.js'

const columnSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'integer', 'float', 'boolean', 'enum', 'list', 'color', 'config']),
  required: z.boolean().optional().default(false),
  min: z.number().optional(),
  max: z.number().optional(),
  values: z.array(z.string()).optional(),
  configRef: z.string().optional(),
})

export function registerTableTools(server: McpServer, store: JsonStore) {
  server.tool('list_tables', 'List all tables (schemas) in a project', { projectId: z.string() }, async ({ projectId }) => {
    try {
      const schemas = store.listSchemas(projectId)
      const summary = schemas.map((s: any) => ({
        id: s.id,
        name: s.name,
        mode: s.mode,
        fieldCount: s.fields ? s.fields.length : 0,
      }))
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] }
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  })

  server.tool('get_table', 'Get a table (schema) with all fields', { tableId: z.string() }, async ({ tableId }) => {
    try {
      const schema = store.getSchema(tableId)
      return { content: [{ type: 'text' as const, text: JSON.stringify(schema, null, 2) }] }
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  })

  server.tool(
    'create_table',
    'Create a new table (schema) in a project',
    {
      projectId: z.string(),
      name: z.string(),
      mode: z.enum(['data', 'config']).optional().default('data'),
      columns: z.array(columnSchema).optional().default([]),
    },
    async ({ projectId, name, mode, columns }) => {
      try {
        const schema = store.createSchema(projectId, name, columns as any[], mode)
        return { content: [{ type: 'text' as const, text: JSON.stringify(schema, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )

  server.tool(
    'rename_table',
    'Rename an existing table (schema)',
    {
      tableId: z.string(),
      name: z.string(),
    },
    async ({ tableId, name }) => {
      try {
        const schema = store.renameSchema(tableId, name)
        return { content: [{ type: 'text' as const, text: JSON.stringify(schema, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )

  server.tool('delete_table', 'Delete a table (schema) by ID', { tableId: z.string() }, async ({ tableId }) => {
    try {
      store.deleteSchema(tableId)
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, tableId }, null, 2) }] }
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  })
}
