import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { DataStore } from '../store/data-store.js'

const environmentEnum = z.enum(['development', 'staging', 'production'])

export function registerVersionTools(server: McpServer, store: DataStore) {
  server.tool('list_versions', 'List all versions for a project', { projectId: z.string() }, async ({ projectId }) => {
    try {
      const versions = await store.listVersions(projectId)
      return { content: [{ type: 'text' as const, text: JSON.stringify(versions, null, 2) }] }
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  })

  server.tool(
    'publish_version',
    'Publish a new version for a project in the specified environment',
    {
      projectId: z.string(),
      environment: environmentEnum,
    },
    async ({ projectId, environment }) => {
      try {
        const version = await store.publishVersion(projectId, environment)
        return { content: [{ type: 'text' as const, text: JSON.stringify(version, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )

  server.tool(
    'promote_version',
    'Promote a version to a higher environment',
    {
      versionId: z.string(),
      targetEnvironment: environmentEnum,
    },
    async ({ versionId, targetEnvironment }) => {
      try {
        const version = await store.promoteVersion(versionId, targetEnvironment)
        return { content: [{ type: 'text' as const, text: JSON.stringify(version, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )

  server.tool('rollback_version', 'Rollback to a previous version', { versionId: z.string() }, async ({ versionId }) => {
    try {
      const version = await store.rollbackVersion(versionId)
      return { content: [{ type: 'text' as const, text: JSON.stringify(version, null, 2) }] }
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  })

  server.tool('delete_version', 'Delete a version by ID', { versionId: z.string() }, async ({ versionId }) => {
    try {
      await store.deleteVersion(versionId)
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, versionId }, null, 2) }] }
    } catch (e) {
      return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
    }
  })

  server.tool(
    'compare_versions',
    'Compare two versions and show differences',
    {
      versionId1: z.string(),
      versionId2: z.string(),
    },
    async ({ versionId1, versionId2 }) => {
      try {
        const diff = await store.compareVersions(versionId1, versionId2)
        return { content: [{ type: 'text' as const, text: JSON.stringify(diff, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true }
      }
    },
  )
}
