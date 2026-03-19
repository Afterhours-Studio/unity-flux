import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { JsonStore } from '../store/json-store.js'

export function registerProjectTools(server: McpServer, store: JsonStore) {
  server.tool('list_projects', 'List all projects', {}, async () => {
    try {
      const projects = store.listProjects()
      return { content: [{ type: 'text' as const, text: JSON.stringify(projects, null, 2) }] }
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  })

  server.tool('get_project', 'Get a project by ID', { projectId: z.string() }, async ({ projectId }) => {
    try {
      const project = store.getProject(projectId)
      return { content: [{ type: 'text' as const, text: JSON.stringify(project, null, 2) }] }
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  })

  server.tool(
    'create_project',
    'Create a new project',
    {
      name: z.string(),
      description: z.string().optional().default(''),
    },
    async ({ name, description }) => {
      try {
        const project = store.createProject(name, description)
        return { content: [{ type: 'text' as const, text: JSON.stringify(project, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )

  server.tool(
    'update_project',
    'Update an existing project',
    {
      projectId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      supabaseUrl: z.string().optional(),
      r2BucketUrl: z.string().optional(),
      environment: z.enum(['development', 'staging', 'production']).optional(),
    },
    async ({ projectId, name, description, supabaseUrl, r2BucketUrl, environment }) => {
      try {
        const updates: Record<string, unknown> = {}
        if (name !== undefined) updates.name = name
        if (description !== undefined) updates.description = description
        if (supabaseUrl !== undefined) updates.supabaseUrl = supabaseUrl
        if (r2BucketUrl !== undefined) updates.r2BucketUrl = r2BucketUrl
        if (environment !== undefined) updates.environment = environment
        const project = store.updateProject(projectId, updates)
        return { content: [{ type: 'text' as const, text: JSON.stringify(project, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )

  server.tool('delete_project', 'Delete a project by ID', { projectId: z.string() }, async ({ projectId }) => {
    try {
      store.deleteProject(projectId)
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, projectId }, null, 2) }] }
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  })
}
