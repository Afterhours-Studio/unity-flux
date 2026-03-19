import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { JsonStore } from '../store/json-store.js'

export function registerRowTools(server: McpServer, store: JsonStore) {
  server.tool('list_rows', 'List all rows (entries) in a table', { tableId: z.string() }, async ({ tableId }) => {
    try {
      const entries = store.listEntries(tableId)
      return { content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }] }
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  })

  server.tool('get_row', 'Get a single row (entry) by ID', { rowId: z.string() }, async ({ rowId }) => {
    try {
      const entry = store.getEntry(rowId)
      return { content: [{ type: 'text' as const, text: JSON.stringify(entry, null, 2) }] }
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  })

  server.tool(
    'add_row',
    'Add a new row (entry) to a table',
    {
      tableId: z.string(),
      data: z.record(z.string(), z.unknown()),
      environment: z.enum(['development', 'staging', 'production']).optional().default('development'),
    },
    async ({ tableId, data, environment }) => {
      try {
        const entry = store.createEntry(tableId, data, environment)
        return { content: [{ type: 'text' as const, text: JSON.stringify(entry, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )

  server.tool(
    'update_row',
    'Update an existing row (entry)',
    {
      rowId: z.string(),
      data: z.record(z.string(), z.unknown()),
    },
    async ({ rowId, data }) => {
      try {
        const entry = store.updateEntry(rowId, data)
        return { content: [{ type: 'text' as const, text: JSON.stringify(entry, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )

  server.tool('delete_row', 'Delete a row (entry) by ID', { rowId: z.string() }, async ({ rowId }) => {
    try {
      store.deleteEntry(rowId)
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, rowId }, null, 2) }] }
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  })
}
