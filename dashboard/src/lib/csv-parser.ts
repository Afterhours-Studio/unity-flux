export interface CsvParseResult {
  headers: string[]
  rows: Record<string, string>[]
  errors: string[]
}

export function parseCsv(text: string): CsvParseResult {
  // Remove BOM
  const clean = text.replace(/^\uFEFF/, '')
  const errors: string[] = []

  const lines = parseLines(clean)
  if (lines.length === 0) return { headers: [], rows: [], errors: ['Empty CSV'] }

  const headers = lines[0]
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i]
    if (fields.length === 1 && fields[0] === '') continue // skip empty lines
    if (fields.length !== headers.length) {
      errors.push(`Row ${i}: expected ${headers.length} fields, got ${fields.length}`)
      continue
    }
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j]
    }
    rows.push(row)
  }

  return { headers, rows, errors }
}

function parseLines(text: string): string[][] {
  // Full RFC 4180 parser with quoted field support
  const result: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        field += ch
        i++
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
      } else if (ch === ',') {
        current.push(field.trim())
        field = ''
        i++
      } else if (ch === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') i++
        current.push(field.trim())
        field = ''
        result.push(current)
        current = []
        i++
      } else if (ch === '\n') {
        current.push(field.trim())
        field = ''
        result.push(current)
        current = []
        i++
      } else {
        field += ch
        i++
      }
    }
  }

  // Handle last field/line
  if (field || current.length > 0) {
    current.push(field.trim())
    result.push(current)
  }

  return result
}

/** Coerce CSV string value to the appropriate JS type based on schema field type */
export function coerceValue(raw: string, type: string, fieldDefault?: unknown): unknown {
  if (raw === '' || raw === undefined) return fieldDefault ?? getTypeDefault(type)

  switch (type) {
    case 'integer': {
      const n = parseInt(raw, 10)
      return isNaN(n) ? 0 : n
    }
    case 'float': {
      const n = parseFloat(raw)
      return isNaN(n) ? 0 : n
    }
    case 'boolean':
      return raw.toLowerCase() === 'true' || raw === '1'
    default:
      return raw
  }
}

function getTypeDefault(type: string): unknown {
  switch (type) {
    case 'integer': return 0
    case 'float': return 0
    case 'boolean': return false
    case 'color': return '#000000'
    default: return ''
  }
}
