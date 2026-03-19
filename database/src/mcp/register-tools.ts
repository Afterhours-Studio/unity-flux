import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { McpDashboardProxy } from './proxy.js'

/**
 * Register all MCP tools with the proxy as executor.
 * Tool definitions (name, description, schema) live here.
 * Actual execution happens in the dashboard via WebSocket.
 */
export function registerProxyTools(server: McpServer, proxy: McpDashboardProxy) {
  const tool = (
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
  ) => {
    server.tool(name, description, schema, async (params) => {
      const result = await proxy.executeTool(name, params as Record<string, unknown>)
      return { ...result } as { content: { type: 'text'; text: string }[]; isError?: boolean; [key: string]: unknown }
    })
  }

  // ─── Projects ───────────────────────────────────────
  tool('list_projects', 'List all projects', {})
  tool('get_project', 'Get a project by ID', { projectId: z.string() })
  tool('create_project', 'Create a new project', {
    name: z.string(),
    description: z.string().optional().default(''),
  })
  tool('update_project', 'Update a project', {
    projectId: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    supabaseUrl: z.string().optional(),
    r2BucketUrl: z.string().optional(),
    environment: z.enum(['development', 'staging', 'production']).optional(),
  })
  tool('delete_project', 'Delete a project and all its data', { projectId: z.string() })

  // ─── Tables ─────────────────────────────────────────
  tool('list_tables', 'List tables in a project', { projectId: z.string() })
  tool('get_table', 'Get a table by ID', { tableId: z.string() })
  tool('create_table', 'Create a new table', {
    projectId: z.string(),
    name: z.string(),
    mode: z.enum(['data', 'config']).optional().default('data'),
    columns: z.array(z.object({
      name: z.string(),
      type: z.enum(['string', 'integer', 'float', 'boolean', 'enum', 'list', 'color', 'config']),
      required: z.boolean().optional().default(false),
      values: z.array(z.string()).optional(),
      configRef: z.string().optional(),
    })).optional().default([]),
  })
  tool('rename_table', 'Rename a table', { tableId: z.string(), name: z.string() })
  tool('delete_table', 'Delete a table and all its rows', { tableId: z.string() })

  // ─── Columns ────────────────────────────────────────
  tool('add_column', 'Add a column to a table', {
    tableId: z.string(),
    name: z.string(),
    type: z.enum(['string', 'integer', 'float', 'boolean', 'enum', 'list', 'color', 'config']),
    required: z.boolean().optional().default(false),
    values: z.array(z.string()).optional(),
    configRef: z.string().optional(),
  })
  tool('update_column', 'Update a column in a table', {
    tableId: z.string(),
    columnName: z.string(),
    type: z.enum(['string', 'integer', 'float', 'boolean', 'enum', 'list', 'color', 'config']).optional(),
    required: z.boolean().optional(),
    values: z.array(z.string()).optional(),
    configRef: z.string().optional(),
  })
  tool('remove_column', 'Remove a column from a table', {
    tableId: z.string(),
    columnName: z.string(),
  })

  // ─── Rows ───────────────────────────────────────────
  tool('list_rows', 'List rows in a table', { tableId: z.string() })
  tool('get_row', 'Get a row by ID', { rowId: z.string() })
  tool('add_row', 'Add a row to a table', {
    tableId: z.string(),
    data: z.record(z.unknown()),
    environment: z.enum(['development', 'staging', 'production']).optional().default('development'),
  })
  tool('update_row', 'Update a row', {
    rowId: z.string(),
    data: z.record(z.unknown()),
  })
  tool('delete_row', 'Delete a row', { rowId: z.string() })

  // ─── Versions ───────────────────────────────────────
  tool('list_versions', 'List published versions', { projectId: z.string() })
  tool('publish_version', 'Publish a new version', {
    projectId: z.string(),
    environment: z.enum(['development', 'staging', 'production']),
  })
  tool('promote_version', 'Promote a version to another environment', {
    versionId: z.string(),
    targetEnvironment: z.enum(['development', 'staging', 'production']),
  })
  tool('rollback_version', 'Rollback to a previous version', { versionId: z.string() })
  tool('delete_version', 'Delete a version', { versionId: z.string() })
  tool('compare_versions', 'Compare two versions', {
    versionId1: z.string(),
    versionId2: z.string(),
  })

  // ─── Activity ───────────────────────────────────────
  tool('list_activity', 'List recent activity for a project', {
    projectId: z.string(),
    limit: z.number().optional(),
  })

  // ─── Codegen ────────────────────────────────────────
  tool('generate_csharp_code', 'Generate C# classes for Unity SDK', {
    projectId: z.string(),
  })
}
