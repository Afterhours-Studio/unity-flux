import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { JsonStore } from '../store/json-store.js'

const columnTypes = z.enum(['string', 'integer', 'float', 'boolean', 'enum', 'list', 'color', 'config'])

export function registerColumnTools(server: McpServer, store: JsonStore) {
  server.tool(
    'add_column',
    'Add a column (field) to a table',
    {
      tableId: z.string(),
      name: z.string(),
      type: columnTypes,
      required: z.boolean().optional().default(false),
      min: z.number().optional(),
      max: z.number().optional(),
      values: z.array(z.string()).optional(),
      configRef: z.string().optional(),
    },
    async ({ tableId, name, type, required, min, max, values, configRef }) => {
      try {
        const field: Record<string, unknown> = { name, type, required }
        if (min !== undefined) field.min = min
        if (max !== undefined) field.max = max
        if (values !== undefined) field.values = values
        if (configRef !== undefined) field.configRef = configRef
        const schema = store.addColumn(tableId, field as any)
        return { content: [{ type: 'text' as const, text: JSON.stringify(schema, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )

  server.tool(
    'update_column',
    'Update a column (field) in a table',
    {
      tableId: z.string(),
      columnName: z.string(),
      name: z.string().optional(),
      type: columnTypes.optional(),
      required: z.boolean().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      values: z.array(z.string()).optional(),
    },
    async ({ tableId, columnName, name, type, required, min, max, values }) => {
      try {
        const updates: Record<string, unknown> = {}
        if (name !== undefined) updates.name = name
        if (type !== undefined) updates.type = type
        if (required !== undefined) updates.required = required
        if (min !== undefined) updates.min = min
        if (max !== undefined) updates.max = max
        if (values !== undefined) updates.values = values
        const schema = store.updateColumn(tableId, columnName, updates)
        return { content: [{ type: 'text' as const, text: JSON.stringify(schema, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )

  server.tool(
    'remove_column',
    'Remove a column (field) from a table',
    {
      tableId: z.string(),
      columnName: z.string(),
    },
    async ({ tableId, columnName }) => {
      try {
        const schema = store.removeColumn(tableId, columnName)
        return { content: [{ type: 'text' as const, text: JSON.stringify(schema, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )
}
