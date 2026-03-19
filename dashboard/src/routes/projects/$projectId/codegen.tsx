import { createFileRoute, useParams } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { Copy, Download, Code, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
// import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProjectStore } from '@/stores/project-store'
import { useShallow } from 'zustand/shallow'
import { cn } from '@/lib/utils'
import { PageTransition } from '@/components/motion'
import { toast } from 'sonner'
import type { Schema, SchemaField } from '@/types/project'

export const Route = createFileRoute('/projects/$projectId/codegen')({
  component: CodegenPage,
})

/* ═══════════════════════════════════════════════ */
/*  Helpers                                        */
/* ═══════════════════════════════════════════════ */

/** Convert a slug like "my-cool-game" to PascalCase "MyCoolGame" */
function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
}

/** Map SchemaField.type to C# type string */
function csharpType(field: SchemaField, className: string): string {
  switch (field.type) {
    case 'string':
      return 'string'
    case 'integer':
      return 'int'
    case 'float':
      return 'float'
    case 'boolean':
      return 'bool'
    case 'enum':
      return `${className}_${toPascalCase(field.name)}`
    case 'list':
      return 'List<string>'
    case 'color':
      return 'Color'
    case 'config':
      return 'string'
    default:
      return 'string'
  }
}

/** Capitalize the first letter of a value for C# enum member names */
function enumMemberName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_]/g, '')
  if (!cleaned) return 'Unknown'
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
  const members = field.values.map((v) => `${indent}    ${enumMemberName(v)}`).join(',\n')
  return `${indent}public enum ${enumName}\n${indent}{\n${members}\n${indent}}\n\n`
}

function generateDataClass(schema: Schema, _namespace: string): string {
  const className = toPascalCase(schema.name)
  const indent = '    '

  // Collect enum definitions
  let enums = ''
  for (const field of schema.fields) {
    enums += generateEnumBlock(field, className, indent)
  }

  // Build field lines: [SerializeField] private + public getter
  const fields = schema.fields
    .map((f) => {
      const csType = csharpType(f, className)
      const privateName = `_${f.name}`
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

function generateConfigClass(schema: Schema): string {
  const className = toPascalCase(schema.name)
  const indent = '    '
  return (
    `${indent}[Serializable]\n` +
    `${indent}public class ${className} : FluxConfigTable\n` +
    `${indent}{\n` +
    `${indent}${indent}// Access: ${className}.Get<int>("max_hp")\n` +
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

function generateFullCode(
  schemas: Schema[],
  selectedIds: Set<string>,
  namespace: string,
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
      body += generateConfigClass(schema)
    } else {
      body += generateDataClass(schema, namespace)
    }
  }

  // Always append FluxLoader
  body += '\n' + generateFluxLoader(indent)

  return `${header}\nnamespace ${namespace}\n{\n${body}}\n`
}

/* ═══════════════════════════════════════════════ */
/*  Syntax highlighting (simple span-based)        */
/* ═══════════════════════════════════════════════ */

function highlightCSharp(code: string): string {
  // Escape HTML entities first
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Comments (// ...) — must come first to avoid inner replacements
  html = html.replace(
    /(\/\/.*)/g,
    '<span class="cs-comment">$1</span>',
  )

  // Strings ("...")
  html = html.replace(
    /(&quot;[^&]*&quot;|"[^"]*")/g,
    '<span class="cs-string">$1</span>',
  )

  // Keywords
  const keywords = [
    'using',
    'namespace',
    'public',
    'private',
    'static',
    'class',
    'enum',
    'struct',
    'return',
    'var',
    'new',
    'where',
    'readonly',
  ]
  const kwPattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g')
  html = html.replace(kwPattern, '<span class="cs-keyword">$1</span>')

  // Attributes — [Serializable] etc.
  html = html.replace(
    /(\[Serializable\])/g,
    '<span class="cs-keyword">$1</span>',
  )

  // Types
  const types = [
    'int',
    'string',
    'float',
    'bool',
    'void',
    'List',
    'Color',
    'JsonUtility',
    'T',
  ]
  const typePattern = new RegExp(`\\b(${types.join('|')})\\b`, 'g')
  html = html.replace(typePattern, '<span class="cs-type">$1</span>')

  // Enum member values inside enum blocks — capitalize pattern after indentation
  // Match lines that are purely "    SomeValue," or "    SomeValue"
  html = html.replace(
    /^(\s*)((?:[A-Z][a-zA-Z0-9_]*))([,]?)$/gm,
    (match, ws, name, comma) => {
      // Only color if it looks like an enum member (no spans already, starts with uppercase, short)
      if (match.includes('<span')) return match
      if (/^[A-Z][a-zA-Z0-9_]*$/.test(name)) {
        return `${ws}<span class="cs-enum">${name}</span>${comma}`
      }
      return match
    },
  )

  return html
}

/* ═══════════════════════════════════════════════ */
/*  Component                                      */
/* ═══════════════════════════════════════════════ */

function CodegenPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/codegen' })

  const project = useProjectStore((s) => s.getProject(projectId))
  const schemas = useProjectStore(
    useShallow((s) => s.schemas.filter((sc) => sc.projectId === projectId)),
  )

  const defaultNamespace = project ? toPascalCase(project.slug) : 'GameConfig'
  const [namespace, setNamespace] = useState(defaultNamespace)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(schemas.map((s) => s.id)),
  )
  const [copied, setCopied] = useState(false)

  // Keep selections in sync when schemas change (new schema added should be checked)
  const schemaIdSet = useMemo(() => new Set(schemas.map((s) => s.id)), [schemas])
  useMemo(() => {
    // Add any newly-created schemas to selected set
    for (const id of schemaIdSet) {
      if (!selectedIds.has(id)) {
        setSelectedIds((prev) => new Set([...prev, id]))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaIdSet])

  const rawCode = useMemo(
    () => generateFullCode(schemas, selectedIds, namespace || 'GameConfig'),
    [schemas, selectedIds, namespace],
  )

  const highlightedHtml = useMemo(() => highlightCSharp(rawCode), [rawCode])

  function toggleSchema(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === schemas.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(schemas.map((s) => s.id)))
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(rawCode)
      setCopied(true)
      toast.success('Code copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  function handleDownload() {
    const blob = new Blob([rawCode], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${namespace || 'GameConfig'}.cs`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Downloaded ${namespace || 'GameConfig'}.cs`)
  }

  if (!project) return null

  return (
    <PageTransition className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">C# Code Generation</h2>
          <span className="text-xs text-muted-foreground">
            {selectedIds.size} of {schemas.length} schemas selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleCopy}
            disabled={schemas.length === 0}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? 'Copied' : 'Copy All'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleDownload}
            disabled={schemas.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Download .cs
          </Button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel — schema checklist */}
        <div className="w-64 border-r bg-muted/30 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
          {/* Namespace input */}
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Namespace</Label>
            <Input
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder="GameConfig"
              className="text-xs h-8 font-mono"
            />
          </div>

          {/* Schema list */}
          <div className="grid gap-1">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Schemas</Label>
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] text-primary hover:underline"
              >
                {selectedIds.size === schemas.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {schemas.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No schemas defined yet. Create schemas in the Data tab to generate C# classes.
              </p>
            ) : (
              <div className="space-y-0.5">
                {schemas.map((schema) => (
                  <label
                    key={schema.id}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors',
                      'hover:bg-muted',
                      selectedIds.has(schema.id) && 'bg-muted',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(schema.id)}
                      onChange={() => toggleSchema(schema.id)}
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium truncate block">
                        {schema.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {schema.mode === 'config' ? 'Config' : `${schema.fields.length} fields`}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel — code preview */}
        <div className="flex-1 min-w-0 overflow-auto bg-zinc-950">
          <pre
            className="p-6 text-[13px] leading-relaxed font-mono text-zinc-100 min-h-full [&_.cs-keyword]:text-purple-400 [&_.cs-type]:text-blue-400 [&_.cs-comment]:text-zinc-500 [&_.cs-string]:text-amber-300 [&_.cs-enum]:text-green-400"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </div>
      </div>
    </PageTransition>
  )
}
