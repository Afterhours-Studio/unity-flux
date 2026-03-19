import { useProjectStore } from '@/stores/project-store'
import type { SchemaField } from '@/types/project'

type ToolFn = (params: Record<string, unknown>) => unknown

function store() {
  return useProjectStore.getState()
}

/**
 * Maps MCP tool names → Zustand store actions.
 * All execution happens in-browser, modifying dashboard state.
 */
export const toolExecutors: Record<string, ToolFn> = {
  // ─── Projects ───────────────────────────────────────
  list_projects: () => store().projects,

  get_project: ({ projectId }) => store().getProject(projectId as string) ?? null,

  create_project: ({ name, description }) =>
    store().addProject(name as string, (description as string) ?? ''),

  update_project: ({ projectId, ...updates }) => {
    store().updateProject(projectId as string, updates)
    return store().getProject(projectId as string)
  },

  delete_project: ({ projectId }) => {
    store().deleteProject(projectId as string)
    return { ok: true }
  },

  // ─── Tables ─────────────────────────────────────────
  list_tables: ({ projectId }) => store().getSchemasByProject(projectId as string),

  get_table: ({ tableId }) =>
    store().schemas.find((s) => s.id === tableId) ?? null,

  create_table: ({ projectId, name, columns, mode }) =>
    store().addSchema(
      projectId as string,
      name as string,
      (columns as SchemaField[]) ?? [],
      (mode as 'data' | 'config') ?? 'data',
    ),

  rename_table: ({ tableId, name }) => {
    store().updateSchema(tableId as string, { name: name as string })
    return store().schemas.find((s) => s.id === tableId)
  },

  delete_table: ({ tableId }) => {
    store().deleteSchema(tableId as string)
    return { ok: true }
  },

  // ─── Columns ────────────────────────────────────────
  add_column: ({ tableId, name, type, required, values, configRef }) => {
    const schema = store().schemas.find((s) => s.id === tableId)
    if (!schema) throw new Error(`Table not found: ${tableId}`)
    const field: SchemaField = {
      name: name as string,
      type: type as SchemaField['type'],
      required: (required as boolean) ?? false,
      ...(values ? { values: values as string[] } : {}),
      ...(configRef ? { configRef: configRef as string } : {}),
    }
    store().updateSchema(tableId as string, {
      fields: [...schema.fields, field],
    })
    return store().schemas.find((s) => s.id === tableId)
  },

  update_column: ({ tableId, columnName, ...updates }) => {
    const schema = store().schemas.find((s) => s.id === tableId)
    if (!schema) throw new Error(`Table not found: ${tableId}`)
    const fields = schema.fields.map((f) =>
      f.name === columnName ? { ...f, ...updates } : f,
    )
    store().updateSchema(tableId as string, { fields: fields as SchemaField[] })
    return store().schemas.find((s) => s.id === tableId)
  },

  remove_column: ({ tableId, columnName }) => {
    const schema = store().schemas.find((s) => s.id === tableId)
    if (!schema) throw new Error(`Table not found: ${tableId}`)
    store().updateSchema(tableId as string, {
      fields: schema.fields.filter((f) => f.name !== columnName),
    })
    return store().schemas.find((s) => s.id === tableId)
  },

  // ─── Rows ───────────────────────────────────────────
  list_rows: ({ tableId }) => store().getEntriesBySchema(tableId as string),

  get_row: ({ rowId }) =>
    store().entries.find((e) => e.id === rowId) ?? null,

  add_row: ({ tableId, data, environment }) =>
    store().addEntry(
      tableId as string,
      data as Record<string, unknown>,
      (environment as 'development' | 'staging' | 'production') ?? 'development',
    ),

  update_row: ({ rowId, data }) => {
    store().updateEntry(rowId as string, data as Record<string, unknown>)
    return store().entries.find((e) => e.id === rowId)
  },

  delete_row: ({ rowId }) => {
    store().deleteEntry(rowId as string)
    return { ok: true }
  },

  // ─── Versions ───────────────────────────────────────
  list_versions: ({ projectId }) =>
    store().getVersionsByProject(projectId as string),

  publish_version: ({ projectId, environment }) =>
    store().publishVersion(
      projectId as string,
      environment as 'development' | 'staging' | 'production',
    ),

  promote_version: ({ versionId, targetEnvironment }) =>
    store().promoteVersion(
      versionId as string,
      targetEnvironment as 'development' | 'staging' | 'production',
    ),

  rollback_version: ({ versionId }) => {
    store().rollbackVersion(versionId as string)
    return { ok: true }
  },

  delete_version: ({ versionId }) => {
    store().deleteVersion(versionId as string)
    return { ok: true }
  },

  compare_versions: ({ versionId1, versionId2 }) =>
    store().compareVersions(versionId1 as string, versionId2 as string),

  // ─── Activity ───────────────────────────────────────
  list_activity: ({ projectId }) =>
    store().getActivitiesByProject(projectId as string),

  // ─── Codegen ────────────────────────────────────────
  generate_csharp_code: ({ projectId }) => {
    const s = store()
    const schemas = s.getSchemasByProject(projectId as string)
    if (schemas.length === 0) return { code: '// No tables found' }

    let code = '// Auto-generated by Unity Flux\n'
    code += 'using UnityEngine;\nusing System;\n\n'

    for (const schema of schemas) {
      code += `[Serializable]\npublic class ${schema.name}\n{\n`
      for (const field of schema.fields) {
        const csType = ({ string: 'string', integer: 'int', float: 'float', boolean: 'bool', enum: 'string', list: 'string[]', color: 'string', config: 'string' } as Record<string, string>)[field.type] ?? 'string'
        const fieldName = '_' + field.name.charAt(0).toLowerCase() + field.name.slice(1)
        const propName = field.name.charAt(0).toUpperCase() + field.name.slice(1)
        code += `    [SerializeField] private ${csType} ${fieldName};\n`
        code += `    public ${csType} ${propName} => ${fieldName};\n\n`
      }
      code += '}\n\n'
    }

    return { code }
  },
}
