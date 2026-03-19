import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { JsonStore } from '../store/json-store.js'

export function registerActivityTools(server: McpServer, store: JsonStore) {
  server.tool(
    'list_activity',
    'List recent activity log entries for a project',
    {
      projectId: z.string(),
      limit: z.number().optional().default(20),
    },
    async ({ projectId, limit }) => {
      try {
        const activity = store.listActivity(projectId, limit)
        return { content: [{ type: 'text' as const, text: JSON.stringify(activity, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )
}
