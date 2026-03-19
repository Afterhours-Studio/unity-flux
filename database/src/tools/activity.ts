import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { DataStore } from '../store/data-store.js'

export function registerActivityTools(server: McpServer, store: DataStore) {
  server.tool(
    'list_activity',
    'List recent activity log entries for a project',
    {
      projectId: z.string(),
      limit: z.number().optional().default(20),
    },
    async ({ projectId, limit }) => {
      try {
        const activity = await store.listActivity(projectId, limit)
        return { content: [{ type: 'text' as const, text: JSON.stringify(activity, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )
}
