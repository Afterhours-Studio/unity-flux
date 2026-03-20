import * as db from '@/lib/supabase-data'
import { generateFullCode } from '@/lib/codegen'
import type { SchemaField } from '@/types/project'

type ToolFn = (params: Record<string, unknown>) => Promise<unknown>

/**
 * Maps MCP tool names → Supabase data layer (async).
 * All execution happens in-browser, calling Supabase directly.
 */
export const toolExecutors: Record<string, ToolFn> = {
  // ─── Projects ───────────────────────────────────────
  list_projects: () => db.listProjects(),

  get_project: ({ projectId }) => db.getProject(projectId as string),

  create_project: ({ name, description }) =>
    db.createProject(name as string, (description as string) ?? ''),

  update_project: async ({ projectId, ...updates }) => {
    return db.updateProject(projectId as string, updates)
  },

  delete_project: async ({ projectId }) => {
    await db.deleteProject(projectId as string)
    return { ok: true }
  },

  // ─── Tables ─────────────────────────────────────────
  list_tables: ({ projectId }) => db.listSchemas(projectId as string),

  get_table: ({ tableId }) => db.getSchema(tableId as string),

  create_table: ({ projectId, name, columns, mode }) =>
    db.createSchema(
      projectId as string,
      name as string,
      (columns as SchemaField[]) ?? [],
      (mode as 'data' | 'config') ?? 'data',
    ),

  rename_table: ({ tableId, name }) =>
    db.renameSchema(tableId as string, name as string),

  delete_table: async ({ tableId }) => {
    await db.deleteSchema(tableId as string)
    return { ok: true }
  },

  // ─── Columns ────────────────────────────────────────
  add_column: ({ tableId, name, type, required, values, configRef }) => {
    const field: SchemaField = {
      name: name as string,
      type: type as SchemaField['type'],
      required: (required as boolean) ?? false,
      ...(values ? { values: values as string[] } : {}),
      ...(configRef ? { configRef: configRef as string } : {}),
    }
    return db.addColumn(tableId as string, field)
  },

  add_columns: ({ tableId, columns }) =>
    db.addColumns(tableId as string, columns as SchemaField[]),

  update_column: ({ tableId, columnName, ...updates }) =>
    db.updateColumn(tableId as string, columnName as string, updates as Partial<SchemaField>),

  remove_column: ({ tableId, columnName }) =>
    db.removeColumn(tableId as string, columnName as string),

  // ─── Rows ───────────────────────────────────────────
  list_rows: ({ tableId }) => db.listEntries(tableId as string),

  get_row: ({ rowId }) => db.getEntry(rowId as string),

  add_row: ({ tableId, data, environment }) =>
    db.createEntry(
      tableId as string,
      data as Record<string, unknown>,
      (environment as 'development' | 'staging' | 'production') ?? 'development',
    ),

  add_rows: ({ tableId, rows, environment }) =>
    db.createEntries(
      tableId as string,
      rows as Record<string, unknown>[],
      (environment as 'development' | 'staging' | 'production') ?? 'development',
    ),

  update_row: ({ rowId, data }) =>
    db.updateEntry(rowId as string, data as Record<string, unknown>),

  update_rows: ({ rows }) =>
    db.updateEntries((rows as { rowId: string; data: Record<string, unknown> }[]).map(r => ({ id: r.rowId, data: r.data }))),

  delete_row: async ({ rowId }) => {
    await db.deleteEntry(rowId as string)
    return { ok: true }
  },

  // ─── Versions ───────────────────────────────────────
  list_versions: ({ projectId }) => db.listVersions(projectId as string),

  publish_version: ({ projectId, environment }) =>
    db.publishVersion(
      projectId as string,
      environment as 'development' | 'staging' | 'production',
    ),

  promote_version: ({ versionId, targetEnvironment }) =>
    db.promoteVersion(
      versionId as string,
      targetEnvironment as 'development' | 'staging' | 'production',
    ),

  rollback_version: async ({ versionId }) => {
    await db.rollbackVersion(versionId as string)
    return { ok: true }
  },

  delete_version: async ({ versionId }) => {
    await db.deleteVersion(versionId as string)
    return { ok: true }
  },

  compare_versions: ({ versionId1, versionId2 }) =>
    db.compareVersions(versionId1 as string, versionId2 as string),

  // ─── Activity ───────────────────────────────────────
  list_activity: ({ projectId }) => db.listActivity(projectId as string),

  // ─── Codegen ────────────────────────────────────────
  generate_csharp_code: async ({ projectId, namespace }) => {
    const schemas = await db.listSchemas(projectId as string)
    if (schemas.length === 0) return { code: '// No tables found' }
    const ns = (namespace as string) || 'GameConfig'

    // Fetch entries for config-mode schemas (needed to generate fields from rows)
    const entriesMap = new Map<string, Awaited<ReturnType<typeof db.listEntries>>>()
    for (const schema of schemas) {
      if (schema.mode === 'config') {
        entriesMap.set(schema.id, await db.listEntries(schema.id))
      }
    }

    const allIds = new Set(schemas.map((s) => s.id))
    const code = generateFullCode(schemas, allIds, ns, entriesMap)
    return { code }
  },

  // ─── Live Ops Events ──────────────────────────────
  list_live_ops_events: ({ projectId }) =>
    db.listLiveOpsEvents(projectId as string),

  create_live_ops_event: ({ projectId, ...event }) =>
    db.createLiveOpsEvent(
      projectId as string,
      event as Parameters<typeof db.createLiveOpsEvent>[1],
    ),

  update_live_ops_event: ({ eventId, ...updates }) =>
    db.updateLiveOpsEvent(
      eventId as string,
      updates as Parameters<typeof db.updateLiveOpsEvent>[1],
    ),

  delete_live_ops_event: async ({ eventId }) => {
    await db.deleteLiveOpsEvent(eventId as string)
    return { ok: true }
  },

  // ─── Battle Pass Tiers ────────────────────────────
  list_battle_pass_tiers: ({ eventId }) =>
    db.listBattlePassTiers(eventId as string),

  create_battle_pass_tier: ({ eventId, ...tier }) =>
    db.createBattlePassTier(
      eventId as string,
      tier as Parameters<typeof db.createBattlePassTier>[1],
    ),

  update_battle_pass_tier: ({ tierId, ...updates }) =>
    db.updateBattlePassTier(
      tierId as string,
      updates as Parameters<typeof db.updateBattlePassTier>[1],
    ),

  delete_battle_pass_tier: async ({ tierId }) => {
    await db.deleteBattlePassTier(tierId as string)
    return { ok: true }
  },

  // ─── Formulas ─────────────────────────────────────
  list_formulas: ({ projectId }) =>
    db.listFormulas(projectId as string),

  create_formula: ({ projectId, ...formula }) =>
    db.createFormula(
      projectId as string,
      formula as Parameters<typeof db.createFormula>[1],
    ),

  update_formula: ({ formulaId, ...updates }) =>
    db.updateFormula(
      formulaId as string,
      updates as Parameters<typeof db.updateFormula>[1],
    ),

  delete_formula: async ({ formulaId }) => {
    await db.deleteFormula(formulaId as string)
    return { ok: true }
  },
}
