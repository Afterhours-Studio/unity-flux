import { createFileRoute, useParams } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueries } from '@tanstack/react-query'
import { Copy, Download, Code, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProject } from '@/hooks/use-projects'
import { useSchemas } from '@/hooks/use-schemas'
import { entryKeys } from '@/hooks/use-entries'
import * as db from '@/lib/supabase-data'
import { cn } from '@/lib/utils'
import { PageTransition } from '@/components/motion'
import { toast } from 'sonner'
import { toPascalCase, generateFullCode } from '@/lib/codegen'
import type { DataEntry } from '@/types/project'

export const Route = createFileRoute('/projects/$projectId/codegen')({
  component: CodegenPage,
})

/* ═══════════════════════════════════════════════ */
/*  Syntax highlighting (tokenizer-based)          */
/* ═══════════════════════════════════════════════ */

/** Escape a string for safe HTML insertion */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const CS_KEYWORDS = new Set([
  'using', 'namespace', 'public', 'private', 'static', 'class', 'enum',
  'struct', 'return', 'var', 'new', 'where', 'readonly',
])
const CS_TYPES = new Set([
  'int', 'string', 'float', 'bool', 'void', 'List', 'Color', 'JsonUtility', 'T',
])

/** Highlight a code fragment (no strings or comments inside) using position-based spans */
function highlightCode(text: string): string {
  const spans: { start: number; end: number; cls: string }[] = []

  // Attributes: [Serializable], [SerializeField]
  for (const m of text.matchAll(/\[(?:Serializable|SerializeField)\]/g)) {
    spans.push({ start: m.index!, end: m.index! + m[0].length, cls: 'cs-keyword' })
  }

  // Keywords + types via word boundary scan
  for (const m of text.matchAll(/\b[a-zA-Z_]\w*\b/g)) {
    const word = m[0]
    const cls = CS_KEYWORDS.has(word) ? 'cs-keyword' : CS_TYPES.has(word) ? 'cs-type' : null
    if (!cls) continue
    if (spans.some(s => m.index! >= s.start && m.index! < s.end)) continue
    spans.push({ start: m.index!, end: m.index! + word.length, cls })
  }

  // Enum members: line is purely "  PascalName," or "  PascalName"
  const enumMatch = text.match(/^(\s*)([A-Z][a-zA-Z0-9_]*)(,?)$/)
  if (enumMatch && spans.length === 0) {
    const ws = enumMatch[1], name = enumMatch[2], comma = enumMatch[3]
    return `${esc(ws)}<span class="cs-enum">${esc(name)}</span>${comma}`
  }

  // Build output from sorted spans
  spans.sort((a, b) => a.start - b.start)
  let result = ''
  let pos = 0
  for (const s of spans) {
    result += esc(text.slice(pos, s.start))
    result += `<span class="${s.cls}">${esc(text.slice(s.start, s.end))}</span>`
    pos = s.end
  }
  result += esc(text.slice(pos))
  return result
}

/**
 * Tokenize-then-highlight: split each line into string / comment / code tokens
 * first, so highlight regexes never see HTML from other tokens.
 */
function highlightCSharp(code: string): string {
  return code.split('\n').map((raw) => {
    const out: string[] = []
    let i = 0
    let inStr = false
    let buf = ''

    while (i < raw.length) {
      if (!inStr && raw[i] === '/' && raw[i + 1] === '/') {
        if (buf) { out.push(highlightCode(buf)); buf = '' }
        out.push(`<span class="cs-comment">${esc(raw.slice(i))}</span>`)
        buf = ''
        i = raw.length
        break
      }
      if (raw[i] === '"') {
        if (!inStr) {
          if (buf) { out.push(highlightCode(buf)); buf = '' }
          buf = '"'
          inStr = true
          i++
          continue
        } else {
          buf += '"'
          out.push(`<span class="cs-string">${esc(buf)}</span>`)
          buf = ''
          inStr = false
          i++
          continue
        }
      }
      if (inStr && raw[i] === '\\' && i + 1 < raw.length) {
        buf += raw[i] + raw[i + 1]
        i += 2
        continue
      }
      buf += raw[i]
      i++
    }
    if (buf) out.push(inStr ? `<span class="cs-string">${esc(buf)}</span>` : highlightCode(buf))
    return out.join('')
  }).join('\n')
}

/* ═══════════════════════════════════════════════ */
/*  Component                                      */
/* ═══════════════════════════════════════════════ */

function CodegenPage() {
  const { t } = useTranslation()
  const { projectId } = useParams({ from: '/projects/$projectId/codegen' })

  const { data: project } = useProject(projectId)
  const { data: schemas = [] } = useSchemas(projectId)

  // Fetch entries for all config-mode schemas (needed to generate fields from rows)
  const configSchemaIds = useMemo(
    () => schemas.filter((s) => s.mode === 'config').map((s) => s.id),
    [schemas],
  )
  const entryQueries = useQueries({
    queries: configSchemaIds.map((sid) => ({
      queryKey: entryKeys.bySchema(sid),
      queryFn: () => db.listEntries(sid),
      enabled: !!sid,
    })),
  })
  const entriesMap = useMemo(() => {
    const map = new Map<string, DataEntry[]>()
    configSchemaIds.forEach((sid, i) => {
      if (entryQueries[i]?.data) map.set(sid, entryQueries[i].data!)
    })
    return map
  }, [configSchemaIds, entryQueries])

  const defaultNamespace = project ? toPascalCase(project.slug) : 'GameConfig'
  const [namespace, setNamespace] = useState(defaultNamespace)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(schemas.map((s) => s.id)),
  )
  const [copied, setCopied] = useState(false)

  // Keep selections in sync when schemas change (new schema added should be checked)
  const schemaIdSet = useMemo(() => new Set(schemas.map((s) => s.id)), [schemas])
  useMemo(() => {
    for (const id of schemaIdSet) {
      if (!selectedIds.has(id)) {
        setSelectedIds((prev) => new Set([...prev, id]))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaIdSet])

  const rawCode = useMemo(
    () => generateFullCode(schemas, selectedIds, namespace || 'GameConfig', entriesMap),
    [schemas, selectedIds, namespace, entriesMap],
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
          <h2 className="text-sm font-medium">{t('codegen.title')}</h2>
          <span className="text-xs text-muted-foreground">
            {t('codegen.schemasSelected', { count: selectedIds.size, total: schemas.length })}
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
            {copied ? t('codegen.copied') : t('codegen.copyCode')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleDownload}
            disabled={schemas.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            {t('codegen.downloadFile')}
          </Button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel — schema checklist */}
        <div className="w-64 border-r bg-muted/30 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
          {/* Namespace input */}
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">{t('codegen.namespace')}</Label>
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
              <Label className="text-xs text-muted-foreground">{t('codegen.schemas')}</Label>
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] text-primary hover:underline"
              >
                {selectedIds.size === schemas.length ? t('codegen.deselectAll') : t('codegen.selectAll')}
              </button>
            </div>

            {schemas.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                {t('codegen.noSchemas')}
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
