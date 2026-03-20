/**
 * Shared C# code generation logic.
 * Used by both the Codegen UI page and the MCP `generate_csharp_code` tool.
 */
import type { Schema, SchemaField, DataEntry } from '@/types/project'

/* ═══════════════════════════════════════════════ */
/*  Naming helpers                                 */
/* ═══════════════════════════════════════════════ */

/**
 * Convert to PascalCase, preserving existing casing boundaries.
 * "my-cool-game"  → "MyCoolGame"
 * "GameConfig"    → "GameConfig"  (not "Gameconfig")
 * "MAX_STACK"     → "MaxStack"
 * "DRSConfig"     → "DRSConfig"   (acronym preserved)
 * "max_hp"        → "MaxHp"
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, _i, arr) => {
      const isAllCaps = w === w.toUpperCase() && w.length > 1
      if (isAllCaps) {
        const allWordsUppercase = arr.every((x) => x === x.toUpperCase())
        if (allWordsUppercase) {
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        }
        return w
      }
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join('')
}

/** Convert to camelCase for C# private field names: "max hp" → "maxHp" */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

/* ═══════════════════════════════════════════════ */
/*  Type mapping                                   */
/* ═══════════════════════════════════════════════ */

/** Map a config row's "type" value (e.g. "int", "float", "list") to C# type */
function configTypeToCSharp(configType: string): string {
  switch (configType.toLowerCase()) {
    case 'int': case 'integer': return 'int'
    case 'float': return 'float'
    case 'bool': case 'boolean': return 'bool'
    case 'list': return 'string[]'
    case 'enum': return 'string'
    case 'color': return 'Color'
    case 'string': default: return 'string'
  }
}

/** Format a value as a C# literal for the given type */
function formatCSharpValue(csType: string, value: unknown): string {
  if (value == null || value === '') {
    switch (csType) {
      case 'int': return '0'
      case 'float': return '0f'
      case 'bool': return 'false'
      case 'string[]': return 'new string[0]'
      default: return '""'
    }
  }
  const str = String(value)
  switch (csType) {
    case 'int': return String(parseInt(str) || 0)
    case 'float': {
      const n = parseFloat(str) || 0
      const s = String(n)
      return s.includes('.') ? `${s}f` : `${s}.0f`
    }
    case 'bool': return str.toLowerCase() === 'true' ? 'true' : 'false'
    case 'string[]': {
      const items = str.split(',').map((s) => s.trim()).filter(Boolean)
      if (items.length === 0) return 'new string[0]'
      const escaped = items.map((s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(', ')
      return `new string[] { ${escaped} }`
    }
    default: return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
}

/** Map SchemaField.type to C# type string */
function csharpType(field: SchemaField, className: string): string {
  switch (field.type) {
    case 'string': return 'string'
    case 'integer': return 'int'
    case 'float': return 'float'
    case 'boolean': return 'bool'
    case 'enum': return `${className}_${toPascalCase(field.name)}`
    case 'list': return 'string[]'
    case 'color': return 'Color'
    case 'config': return 'string'
    default: return 'string'
  }
}

/** Capitalize the first letter of a value for C# enum member names */
function enumMemberName(value: string): string {
  let cleaned = value.replace(/[^a-zA-Z0-9_]/g, '')
  if (!cleaned) return 'Unknown'
  // C# identifiers cannot start with a digit
  if (/^[0-9]/.test(cleaned)) cleaned = `_${cleaned}`
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

/* ═══════════════════════════════════════════════ */
/*  Code generation                                */
/* ═══════════════════════════════════════════════ */

function generateEnumBlock(
  field: SchemaField,
  className: string,
  indent: string,
): string {
  if (field.type !== 'enum' || !field.values?.length) return ''
  const enumName = `${className}_${toPascalCase(field.name)}`
  const seen = new Set<string>()
  const uniqueMembers: string[] = []
  for (const v of field.values) {
    const name = enumMemberName(v)
    if (!seen.has(name)) { seen.add(name); uniqueMembers.push(name) }
  }
  const members = uniqueMembers.map((m) => `${indent}    ${m}`).join(',\n')
  return `${indent}public enum ${enumName}\n${indent}{\n${members}\n${indent}}\n\n`
}

function generateDataClass(schema: Schema, _namespace: string): string {
  const className = toPascalCase(schema.name)
  const indent = '    '

  let enums = ''
  for (const field of schema.fields) {
    enums += generateEnumBlock(field, className, indent)
  }

  const fields = schema.fields
    .map((f) => {
      const csType = csharpType(f, className)
      const privateName = toCamelCase(f.name)
      const publicName = toPascalCase(f.name)
      return (
        `${indent}${indent}[SerializeField] private ${csType} ${privateName};\n` +
        `${indent}${indent}public ${csType} ${publicName} => ${privateName};`
      )
    })
    .join('\n\n')

  return (
    `${enums}` +
    `${indent}[Serializable]\n` +
    `${indent}public class ${className}\n` +
    `${indent}{\n` +
    `${fields}\n` +
    `${indent}}\n`
  )
}

/**
 * Config table codegen: each ROW becomes a C# field.
 * Detects the key/type/value columns from the schema, then reads entries.
 *
 *   | parameter  | type | value |       [SerializeField] private int maxStack = 10;
 *   | MAX_STACK  | int  | 10    |  -->  public int MaxStack => maxStack;
 */
function generateConfigClass(schema: Schema, entries: DataEntry[]): string {
  const className = toPascalCase(schema.name)
  const indent = '    '

  const configField = schema.fields.find((f) => f.type === 'config')
  const valueColName = configField?.configRef
  const keyField = schema.fields.find(
    (f) =>
      f.name !== configField?.name &&
      f.name !== valueColName &&
      !f.name.toLowerCase().includes('description'),
  )

  if (!keyField || !configField || !valueColName || entries.length === 0) {
    return (
      `${indent}[Serializable]\n` +
      `${indent}public class ${className}\n` +
      `${indent}{\n` +
      `${indent}${indent}// No config entries found — add rows in the Blueprint tab\n` +
      `${indent}}\n`
    )
  }

  const fields = entries
    .filter((e) => e.data[keyField.name])
    .map((e) => {
      const paramName = String(e.data[keyField.name])
      const configType = String(e.data[configField.name] ?? 'string')
      const value = e.data[valueColName]

      const csType = configTypeToCSharp(configType)
      const privateName = toCamelCase(paramName)
      const publicName = toPascalCase(paramName)
      const defaultVal = formatCSharpValue(csType, value)

      return (
        `${indent}${indent}[SerializeField] private ${csType} ${privateName} = ${defaultVal};\n` +
        `${indent}${indent}public ${csType} ${publicName} => ${privateName};`
      )
    })
    .join('\n\n')

  return (
    `${indent}[Serializable]\n` +
    `${indent}public class ${className}\n` +
    `${indent}{\n` +
    `${fields}\n` +
    `${indent}}\n`
  )
}

function generateFluxLoader(indent: string): string {
  return (
    `${indent}public static class FluxLoader\n` +
    `${indent}{\n` +
    `${indent}${indent}public static T Load<T>(string json) where T : class\n` +
    `${indent}${indent}{\n` +
    `${indent}${indent}${indent}return JsonUtility.FromJson<T>(json);\n` +
    `${indent}${indent}}\n` +
    `\n` +
    `${indent}${indent}public static List<T> LoadList<T>(string json) where T : class\n` +
    `${indent}${indent}{\n` +
    `${indent}${indent}${indent}var wrapper = JsonUtility.FromJson<ListWrapper<T>>(json);\n` +
    `${indent}${indent}${indent}return wrapper.items;\n` +
    `${indent}${indent}}\n` +
    `\n` +
    `${indent}${indent}[Serializable]\n` +
    `${indent}${indent}private class ListWrapper<T>\n` +
    `${indent}${indent}{\n` +
    `${indent}${indent}${indent}public List<T> items;\n` +
    `${indent}${indent}}\n` +
    `${indent}}\n`
  )
}

/**
 * Generate full C# file from schemas + entries.
 * Used by both the Codegen page (UI) and the MCP generate_csharp_code tool.
 */
export function generateFullCode(
  schemas: Schema[],
  selectedIds: Set<string>,
  namespace: string,
  entriesMap: Map<string, DataEntry[]>,
): string {
  const selected = schemas.filter((s) => selectedIds.has(s.id))
  if (selected.length === 0) {
    return '// No schemas selected. Check at least one schema on the left to generate code.'
  }

  const header =
    '// Auto-generated by Unity Flux \u2014 do not edit manually\n' +
    'using System;\n' +
    'using System.Collections.Generic;\n' +
    'using UnityEngine;\n'

  const indent = '    '
  let body = ''
  for (const schema of selected) {
    if (body) body += '\n'
    if (schema.mode === 'config') {
      body += generateConfigClass(schema, entriesMap.get(schema.id) ?? [])
    } else {
      body += generateDataClass(schema, namespace)
    }
  }

  body += '\n' + generateFluxLoader(indent)

  return `${header}\nnamespace ${namespace}\n{\n${body}}\n`
}
