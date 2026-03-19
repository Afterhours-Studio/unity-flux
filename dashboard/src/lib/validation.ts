import type { DataEntry, Schema, SchemaField } from '@/types/project'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationError {
  entryId: string
  fieldName: string
  message: string
  severity: 'error' | 'warning'
}

export interface ProjectValidationResult {
  errors: ValidationError[]
  errorCount: number
  warningCount: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Returns true when a value should be treated as "empty". */
function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

/**
 * Try to coerce an unknown value into a number.
 * Entry data may arrive as strings from form inputs, so we attempt parsing.
 */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

// ---------------------------------------------------------------------------
// Core field validation
// ---------------------------------------------------------------------------

function validateField(
  entryId: string,
  field: SchemaField,
  value: unknown,
): ValidationError[] {
  const errors: ValidationError[] = []

  const push = (message: string, severity: 'error' | 'warning' = 'error') => {
    errors.push({ entryId, fieldName: field.name, message, severity })
  }

  // Skip internal fields
  if (field.name === '_options') return errors

  // Skip config type columns — they reference dynamic data
  if (field.type === 'config') return errors

  // ---- Required check --------------------------------------------------
  if (field.required && isEmpty(value)) {
    push(`"${field.name}" is required`)
    // No point validating further if the value is missing
    return errors
  }

  // If the value is empty and not required we can stop here
  if (isEmpty(value)) return errors

  // ---- Type checking ----------------------------------------------------
  switch (field.type) {
    case 'string': {
      if (typeof value !== 'string') {
        push(`"${field.name}" must be a string`)
      }
      break
    }

    case 'integer': {
      const num = toNumber(value)
      if (num === null || !Number.isInteger(num)) {
        push(`"${field.name}" must be an integer`)
      } else {
        validateRange(num, field, push)
      }
      break
    }

    case 'float': {
      const num = toNumber(value)
      if (num === null) {
        push(`"${field.name}" must be a number`)
      } else {
        validateRange(num, field, push)
      }
      break
    }

    case 'boolean': {
      if (typeof value !== 'boolean') {
        // Also accept string representations
        if (typeof value === 'string' && (value === 'true' || value === 'false')) {
          // Tolerate string booleans — emit a warning instead
          push(`"${field.name}" is a string boolean — consider storing as a real boolean`, 'warning')
        } else {
          push(`"${field.name}" must be a boolean`)
        }
      }
      break
    }

    case 'enum': {
      if (typeof value !== 'string') {
        push(`"${field.name}" must be a string`)
      } else if (field.values && field.values.length > 0 && !field.values.includes(value)) {
        push(`"${field.name}" must be one of: ${field.values.join(', ')}`)
      }
      break
    }

    case 'list': {
      if (typeof value !== 'string') {
        push(`"${field.name}" must be a comma-separated string`)
      } else if (field.values && field.values.length > 0) {
        const items = value.split(',').map((s) => s.trim()).filter(Boolean)
        const invalid = items.filter((item) => !field.values!.includes(item))
        if (invalid.length > 0) {
          push(`"${field.name}" contains invalid values: ${invalid.join(', ')}. Allowed: ${field.values.join(', ')}`)
        }
      }
      break
    }

    case 'color': {
      if (typeof value !== 'string') {
        push(`"${field.name}" must be a hex color string`)
      } else if (!HEX_COLOR_RE.test(value)) {
        push(`"${field.name}" must be a valid hex color (#RGB or #RRGGBB)`)
      }
      break
    }
  }

  // ---- Pattern check (future-proof — SchemaField can have `pattern`) ----
  const pattern = (field as SchemaField & { pattern?: string }).pattern
  if (pattern && typeof value === 'string') {
    try {
      const re = new RegExp(pattern)
      if (!re.test(value)) {
        push(`"${field.name}" does not match required pattern: ${pattern}`)
      }
    } catch {
      push(`"${field.name}" has an invalid pattern: ${pattern}`, 'warning')
    }
  }

  return errors
}

/** Validate min/max range for numeric values. */
function validateRange(
  num: number,
  field: SchemaField,
  push: (message: string, severity?: 'error' | 'warning') => void,
): void {
  if (field.min !== undefined && num < field.min) {
    push(`"${field.name}" must be >= ${field.min}`)
  }
  if (field.max !== undefined && num > field.max) {
    push(`"${field.name}" must be <= ${field.max}`)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a single entry against its schema.
 * Returns an empty array when the entry is valid.
 */
export function validateEntry(entry: DataEntry, schema: Schema): ValidationError[] {
  const errors: ValidationError[] = []

  for (const field of schema.fields) {
    const value = entry.data[field.name]
    errors.push(...validateField(entry.id, field, value))
  }

  return errors
}

/**
 * Validate all entries that belong to a given schema.
 */
export function validateSchema(entries: DataEntry[], schema: Schema): ValidationError[] {
  const errors: ValidationError[] = []

  for (const entry of entries) {
    errors.push(...validateEntry(entry, schema))
  }

  return errors
}

/**
 * Validate every entry across all schemas for a project.
 * Each entry is matched to its schema via `entry.schemaId`.
 */
export function validateProject(
  entries: DataEntry[],
  schemas: Schema[],
): ProjectValidationResult {
  const schemaMap = new Map<string, Schema>()
  for (const schema of schemas) {
    schemaMap.set(schema.id, schema)
  }

  const errors: ValidationError[] = []

  for (const entry of entries) {
    const schema = schemaMap.get(entry.schemaId)
    if (!schema) {
      errors.push({
        entryId: entry.id,
        fieldName: '',
        message: `Entry references unknown schema "${entry.schemaId}"`,
        severity: 'error',
      })
      continue
    }
    errors.push(...validateEntry(entry, schema))
  }

  let errorCount = 0
  let warningCount = 0
  for (const e of errors) {
    if (e.severity === 'error') errorCount++
    else warningCount++
  }

  return { errors, errorCount, warningCount }
}

/**
 * Filter validation errors down to a specific cell (entry + field).
 */
export function getCellErrors(
  entryId: string,
  fieldName: string,
  errors: ValidationError[],
): ValidationError[] {
  return errors.filter((e) => e.entryId === entryId && e.fieldName === fieldName)
}
