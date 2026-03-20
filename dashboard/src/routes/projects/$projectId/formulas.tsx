import { createFileRoute, useParams } from '@tanstack/react-router'
import { useState, useMemo, useRef, useCallback } from 'react'
import {
  Plus, Trash2, Pencil, FunctionSquare, Loader2, AlertTriangle, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { PageTransition } from '@/components/motion'
import type { Formula, FormulaVariable } from '@/types/project'
import {
  useFormulas, useCreateFormula, useUpdateFormula, useDeleteFormula,
} from '@/hooks/use-formulas'

export const Route = createFileRoute('/projects/$projectId/formulas')({
  component: FormulasPage,
})

/* ═══════════════════════════════════════════════
   Expression Evaluator
   ═══════════════════════════════════════════════ */

const MATH_FNS = ['abs', 'ceil', 'floor', 'round', 'sqrt', 'pow', 'min', 'max', 'log', 'exp', 'sign', 'clamp']

function evaluateFormula(expression: string, variables: Record<string, number>): number | string {
  try {
    const paramNames = Object.keys(variables)
    const paramValues = Object.values(variables)
    // Expose Math functions as top-level names
    const mathSetup = MATH_FNS.map((fn) =>
      fn === 'clamp'
        ? 'const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);'
        : `const ${fn} = Math.${fn};`,
    ).join('\n')
    const fn = new Function(
      ...paramNames,
      `"use strict";\n${mathSetup}\nreturn (${expression});`,
    )
    const result = fn(...paramValues)
    if (typeof result !== 'number' || !isFinite(result)) return 'NaN'
    return Math.round(result * 10000) / 10000
  } catch (e) {
    return e instanceof Error ? e.message : 'Error'
  }
}

function cartesianProduct(arrays: number[][]): number[][] {
  if (arrays.length === 0) return [[]]
  return arrays.reduce<number[][]>(
    (acc, arr) => acc.flatMap((combo) => arr.map((val) => [...combo, val])),
    [[]],
  )
}

/* ═══════════════════════════════════════════════
   Preview Table
   ═══════════════════════════════════════════════ */

function PreviewTable({
  expression,
  variables,
  previewInputs,
}: {
  expression: string
  variables: FormulaVariable[]
  previewInputs: Record<string, number[]>
}) {
  const rows = useMemo(() => {
    if (variables.length === 0 || !expression.trim()) return []
    const varNames = variables.map((v) => v.name)
    const arrays = varNames.map((name) => {
      const vals = previewInputs[name]
      return vals?.length ? vals : [variables.find((v) => v.name === name)?.defaultValue ?? 0]
    })
    const combos = cartesianProduct(arrays)
    // Limit to 200 rows
    return combos.slice(0, 200).map((values) => {
      const vars: Record<string, number> = {}
      varNames.forEach((name, i) => { vars[name] = values[i] })
      const result = evaluateFormula(expression, vars)
      return { values, result }
    })
  }, [expression, variables, previewInputs])

  if (variables.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        Add variables to see preview.
      </p>
    )
  }

  if (!expression.trim()) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        Write an expression to see preview.
      </p>
    )
  }

  return (
    <div className="border rounded-lg overflow-auto max-h-[300px]">
      <Table>
        <TableHeader>
          <TableRow>
            {variables.map((v) => (
              <TableHead key={v.name} className="text-xs font-mono">{v.name}</TableHead>
            ))}
            <TableHead className="text-xs font-mono font-bold">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.values.map((val, j) => (
                <TableCell key={j} className="text-xs font-mono py-1.5">{val}</TableCell>
              ))}
              <TableCell className={cn(
                'text-xs font-mono font-semibold py-1.5',
                typeof row.result === 'string' && 'text-red-500',
              )}>
                {row.result}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Variable Editor
   ═══════════════════════════════════════════════ */

function VariableEditor({
  variables,
  onChange,
  previewInputs,
  onPreviewInputsChange,
}: {
  variables: FormulaVariable[]
  onChange: (vars: FormulaVariable[]) => void
  previewInputs: Record<string, number[]>
  onPreviewInputsChange: (inputs: Record<string, number[]>) => void
}) {
  const addVariable = () => {
    onChange([...variables, { name: '', type: 'float', defaultValue: 0, description: '' }])
  }

  const updateVariable = (index: number, updates: Partial<FormulaVariable>) => {
    const updated = variables.map((v, i) => i === index ? { ...v, ...updates } : v)
    onChange(updated)
  }

  const removeVariable = (index: number) => {
    const name = variables[index].name
    onChange(variables.filter((_, i) => i !== index))
    if (name) {
      const next = { ...previewInputs }
      delete next[name]
      onPreviewInputsChange(next)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Variables</Label>
        <Button variant="ghost" size="sm" onClick={addVariable} className="h-6 text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      {variables.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={v.name}
            onChange={(e) => updateVariable(i, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
            placeholder="name"
            className="text-xs font-mono h-8 flex-1"
          />
          <Select value={v.type} onValueChange={(val) => updateVariable(i, { type: val as 'int' | 'float' })}>
            <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="int">int</SelectItem>
              <SelectItem value="float">float</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={v.defaultValue}
            onChange={(e) => updateVariable(i, { defaultValue: parseFloat(e.target.value) || 0 })}
            placeholder="default"
            className="text-xs font-mono h-8 w-20"
          />
          <Input
            defaultValue={(previewInputs[v.name] ?? []).join(', ')}
            onBlur={(e) => {
              const vals = e.target.value.split(',').map((s) => parseFloat(s.trim())).filter((n) => isFinite(n))
              onPreviewInputsChange({ ...previewInputs, [v.name]: vals })
            }}
            placeholder="1, 5, 10"
            className="text-xs font-mono h-8 flex-1"
            title="Preview values (comma-separated)"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeVariable(i)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      {variables.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">No variables defined.</p>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Formula Templates
   ═══════════════════════════════════════════════ */

interface FormulaTemplate {
  name: string
  description: string
  expression: string
  variables: FormulaVariable[]
  previewInputs: Record<string, number[]>
  outputMode: 'method' | 'lookup'
}

const FORMULA_TEMPLATES: FormulaTemplate[] = [
  {
    name: 'Level HP',
    description: 'Calculate HP based on level with linear growth',
    expression: 'base_hp + level * growth',
    variables: [
      { name: 'base_hp', type: 'float', defaultValue: 100, description: 'Base HP at level 0' },
      { name: 'level', type: 'int', defaultValue: 1, description: 'Character level' },
      { name: 'growth', type: 'float', defaultValue: 50, description: 'HP gained per level' },
    ],
    previewInputs: { base_hp: [100], level: [1, 5, 10, 20, 50], growth: [50] },
    outputMode: 'method',
  },
  {
    name: 'Exponential XP',
    description: 'XP required per level using exponential curve',
    expression: 'floor(base_xp * pow(multiplier, level - 1))',
    variables: [
      { name: 'base_xp', type: 'float', defaultValue: 100, description: 'XP for level 1' },
      { name: 'level', type: 'int', defaultValue: 1, description: 'Target level' },
      { name: 'multiplier', type: 'float', defaultValue: 1.15, description: 'Growth multiplier' },
    ],
    previewInputs: { base_xp: [100], level: [1, 5, 10, 20, 50], multiplier: [1.15] },
    outputMode: 'lookup',
  },
  {
    name: 'Damage Formula',
    description: 'Attack damage with defense reduction',
    expression: 'max(1, round(attack * (100 / (100 + defense))))',
    variables: [
      { name: 'attack', type: 'float', defaultValue: 50, description: 'Attacker ATK stat' },
      { name: 'defense', type: 'float', defaultValue: 30, description: 'Defender DEF stat' },
    ],
    previewInputs: { attack: [30, 50, 80, 120], defense: [10, 30, 50, 80] },
    outputMode: 'method',
  },
  {
    name: 'Crit Damage',
    description: 'Damage with critical hit multiplier',
    expression: 'is_crit ? base_dmg * crit_mult : base_dmg',
    variables: [
      { name: 'base_dmg', type: 'float', defaultValue: 100, description: 'Base damage' },
      { name: 'is_crit', type: 'int', defaultValue: 0, description: '1 if critical hit, 0 otherwise' },
      { name: 'crit_mult', type: 'float', defaultValue: 1.5, description: 'Critical multiplier' },
    ],
    previewInputs: { base_dmg: [50, 100, 200], is_crit: [0, 1], crit_mult: [1.5] },
    outputMode: 'method',
  },
  {
    name: 'Cooldown Reduction',
    description: 'Ability cooldown with diminishing returns',
    expression: 'max(min_cd, base_cd * (1 - cdr / (cdr + 100)))',
    variables: [
      { name: 'base_cd', type: 'float', defaultValue: 10, description: 'Base cooldown (seconds)' },
      { name: 'cdr', type: 'float', defaultValue: 0, description: 'Cooldown reduction stat' },
      { name: 'min_cd', type: 'float', defaultValue: 1, description: 'Minimum cooldown' },
    ],
    previewInputs: { base_cd: [10], cdr: [0, 20, 50, 100, 200], min_cd: [1] },
    outputMode: 'method',
  },
]

/* ═══════════════════════════════════════════════
   Expression Editor
   ═══════════════════════════════════════════════ */

const KNOWN_FUNCTIONS = new Set(MATH_FNS)
const KNOWN_KEYWORDS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'Math'])

type TokenType = 'variable' | 'function' | 'number' | 'operator' | 'paren' | 'unknown' | 'space'
interface Token { text: string; type: TokenType }

function tokenize(expr: string, variableNames: Set<string>): Token[] {
  const tokens: Token[] = []
  const regex = /(\d+\.?\d*(?:e[+-]?\d+)?)|([a-zA-Z_]\w*)|([+\-*/%<>=!&|?:,^]+)|([()[\]])|(\s+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(expr)) !== null) {
    const [text, num, ident, op, paren, space] = match
    if (space) { tokens.push({ text, type: 'space' }); continue }
    if (num) { tokens.push({ text, type: 'number' }); continue }
    if (paren) { tokens.push({ text, type: 'paren' }); continue }
    if (op) { tokens.push({ text, type: 'operator' }); continue }
    if (ident) {
      if (KNOWN_FUNCTIONS.has(ident)) tokens.push({ text, type: 'function' })
      else if (KNOWN_KEYWORDS.has(ident)) tokens.push({ text, type: 'number' })
      else if (variableNames.has(ident)) tokens.push({ text, type: 'variable' })
      else tokens.push({ text, type: 'unknown' })
      continue
    }
    tokens.push({ text, type: 'operator' })
  }
  return tokens
}

const OPERATOR_DISPLAY: Record<string, string> = { '*': '×', '/': '÷' }

function FormulaPreview({ expression, variableNames }: { expression: string; variableNames: Set<string> }) {
  const tokens = useMemo(() => tokenize(expression, variableNames), [expression, variableNames])
  if (!expression.trim()) return null
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 bg-muted/30 rounded-md min-h-[32px] text-sm font-mono">
      {tokens.map((t, i) => {
        if (t.type === 'space') return <span key={i}>{t.text}</span>
        const display = t.type === 'operator' ? (OPERATOR_DISPLAY[t.text] ?? t.text) : t.text
        return (
          <span
            key={i}
            className={cn(
              t.type === 'variable' && 'bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded text-xs',
              t.type === 'function' && 'text-violet-400 font-semibold',
              t.type === 'number' && 'text-amber-400',
              t.type === 'operator' && 'text-muted-foreground px-0.5',
              t.type === 'paren' && 'text-muted-foreground/60',
              t.type === 'unknown' && 'text-red-400 underline decoration-wavy decoration-red-400/50 px-1.5 py-0.5',
            )}
          >
            {display}
          </span>
        )
      })}
    </div>
  )
}

const TOOLBAR_ITEMS = [
  { label: 'pow', insert: 'pow(, )' },
  { label: 'min', insert: 'min(, )' },
  { label: 'max', insert: 'max(, )' },
  { label: 'floor', insert: 'floor()' },
  { label: 'ceil', insert: 'ceil()' },
  { label: 'round', insert: 'round()' },
  { label: 'sqrt', insert: 'sqrt()' },
  { label: 'abs', insert: 'abs()' },
  { label: 'clamp', insert: 'clamp(, , )' },
  { label: '?:', insert: ' ? : ' },
]

function ExpressionEditor({
  value,
  onChange,
  variables,
  onAddVariable,
  error,
}: {
  value: string
  onChange: (v: string) => void
  variables: FormulaVariable[]
  onAddVariable: (name: string) => void
  error: string | null
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const variableNames = useMemo(() => new Set(variables.map((v) => v.name)), [variables])

  const insertAtCursor = useCallback((text: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = value.slice(0, start)
    const after = value.slice(end)
    const newValue = before + text + after
    onChange(newValue)
    // Place cursor inside parentheses if present
    requestAnimationFrame(() => {
      const parenPos = text.indexOf('(')
      const cursorPos = parenPos >= 0 ? start + parenPos + 1 : start + text.length
      ta.focus()
      ta.setSelectionRange(cursorPos, cursorPos)
    })
  }, [value, onChange])

  // Detect undefined identifiers for auto-suggest
  const suggestedVars = useMemo(() => {
    if (!value.trim()) return []
    const identifiers = value.match(/[a-zA-Z_]\w*/g) ?? []
    const unique = [...new Set(identifiers)]
    return unique.filter((id) => !variableNames.has(id) && !KNOWN_FUNCTIONS.has(id) && !KNOWN_KEYWORDS.has(id))
  }, [value, variableNames])

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Expression</Label>
        {error && (
          <span className="flex items-center gap-1 text-[11px] text-red-500">
            <AlertTriangle className="h-3 w-3" />
            {error}
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap">
        {TOOLBAR_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => insertAtCursor(item.insert)}
            className="px-2 py-0.5 text-[11px] font-mono rounded border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Expression + Preview + Suggestions grouped */}
      <div className="border rounded-lg overflow-hidden">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="base_hp + level * growth_rate"
          className="font-mono text-sm min-h-[60px] border-0 rounded-none focus-visible:ring-0 resize-none items-center pt-4"
          rows={3}
        />
        <div className="border-t bg-muted/20 px-3 py-2">
          <FormulaPreview expression={value} variableNames={variableNames} />
        </div>
        {suggestedVars.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap border-t px-3 py-2">
            <span className="text-[11px] text-muted-foreground">Add variable:</span>
            {suggestedVars.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onAddVariable(name)}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono rounded-full border border-dashed border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors"
              >
                <Plus className="h-2.5 w-2.5" />
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   Create / Edit Formula Dialog
   ═══════════════════════════════════════════════ */

function FormulaDialog({
  open,
  onOpenChange,
  projectId,
  formula,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  projectId: string
  formula: Formula | null // null = create mode
}) {
  const createMut = useCreateFormula()
  const updateMut = useUpdateFormula()
  const isEdit = !!formula

  const [step, setStep] = useState<'template' | 'form'>('template')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [expression, setExpression] = useState('')
  const [variables, setVariables] = useState<FormulaVariable[]>([])
  const [outputMode, setOutputMode] = useState<'method' | 'lookup'>('method')
  const [previewInputs, setPreviewInputs] = useState<Record<string, number[]>>({})

  const applyTemplate = (tpl: FormulaTemplate) => {
    setName(tpl.name)
    setDescription(tpl.description)
    setExpression(tpl.expression)
    setVariables(tpl.variables)
    setOutputMode(tpl.outputMode)
    setPreviewInputs(tpl.previewInputs)
    setStep('form')
  }

  // Sync when dialog opens
  const [syncKey, setSyncKey] = useState<string | null>(null)
  const currentKey = open ? (formula?.id ?? '__create__') : null
  if (currentKey && syncKey !== currentKey) {
    if (formula) {
      setName(formula.name)
      setDescription(formula.description)
      setExpression(formula.expression)
      setVariables(formula.variables)
      setOutputMode(formula.outputMode)
      setPreviewInputs(formula.previewInputs)
      setStep('form')
    } else {
      setName('')
      setDescription('')
      setExpression('')
      setVariables([])
      setOutputMode('method')
      setPreviewInputs({})
      setStep('template')
    }
    setSyncKey(currentKey)
  }
  if (!open && syncKey !== null) {
    setSyncKey(null)
  }

  const handleSave = async () => {
    if (!name.trim() || !expression.trim()) return
    const data = {
      name: name.trim(),
      description: description.trim(),
      expression: expression.trim(),
      variables,
      outputMode,
      previewInputs,
    }
    try {
      if (isEdit) {
        await updateMut.mutateAsync({ id: formula.id, projectId, updates: data })
        toast.success('Formula updated')
      } else {
        await createMut.mutateAsync({ projectId, formula: data })
        toast.success(`Formula "${name}" created`)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save formula')
    }
  }

  const isPending = createMut.isPending || updateMut.isPending

  // Validate expression
  const exprError = useMemo(() => {
    if (!expression.trim() || variables.length === 0) return null
    const testVars: Record<string, number> = {}
    variables.forEach((v) => { testVars[v.name] = v.defaultValue })
    const result = evaluateFormula(expression, testVars)
    return typeof result === 'string' ? result : null
  }, [expression, variables])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[960px] p-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>
            {isEdit ? 'Edit Formula' : step === 'template' ? 'Choose Template' : 'New Formula'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Editing ${formula.name}`
              : step === 'template'
                ? 'Pick a template or start from scratch.'
                : 'Configure your formula details.'}
          </DialogDescription>
        </DialogHeader>

        {!isEdit && step === 'template' ? (
          <div className="px-6 py-4 grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
            {FORMULA_TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                onClick={() => applyTemplate(tpl)}
                className="flex flex-col gap-1 p-3 border rounded-lg text-left hover:bg-accent/50 transition-colors"
              >
                <p className="text-sm font-medium">{tpl.name}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">{tpl.description}</p>
                <code className="text-[10px] text-muted-foreground font-mono truncate">{tpl.expression}</code>
              </button>
            ))}
            <button
              onClick={() => setStep('form')}
              className="flex flex-col gap-1 p-3 border rounded-lg text-left hover:bg-accent/50 transition-colors border-dashed"
            >
              <p className="text-sm font-medium">Blank Formula</p>
              <p className="text-[11px] text-muted-foreground">Start from scratch</p>
            </button>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
            <div className="flex items-end gap-3">
              <div className="grid gap-1.5 flex-1">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CalcHP" className="font-mono text-xs" autoFocus />
              </div>
              <Select value={outputMode} onValueChange={(v) => setOutputMode(v as 'method' | 'lookup')}>
                <SelectTrigger className="h-9 text-xs w-auto gap-2 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="method">C# Static Method</SelectItem>
                  <SelectItem value="lookup">Lookup Table</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Calculate HP based on level and growth rate" className="text-xs" />
            </div>

            <VariableEditor
              variables={variables}
              onChange={setVariables}
              previewInputs={previewInputs}
              onPreviewInputsChange={setPreviewInputs}
            />

            <ExpressionEditor
              value={expression}
              onChange={setExpression}
              variables={variables}
              onAddVariable={(name) => {
                setVariables((prev) => [...prev, { name, type: 'float', defaultValue: 0, description: '' }])
              }}
              error={exprError}
            />

            <div className="grid gap-1.5">
              <Label className="text-xs">Preview</Label>
              <PreviewTable expression={expression} variables={variables} previewInputs={previewInputs} />
            </div>
          </div>
        )}

        <DialogFooter className="px-6 pb-6 pt-2 border-t shrink-0">
          {!isEdit && step === 'form' && (
            <Button variant="outline" onClick={() => setStep('template')}>Back</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {(isEdit || step === 'form') && (
            <Button onClick={handleSave} disabled={!name.trim() || !expression.trim() || isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Formula'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════ */

function FormulasPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/formulas' })
  const { data: formulas = [], isLoading } = useFormulas(projectId)
  const deleteMut = useDeleteFormula()
  const [createOpen, setCreateOpen] = useState(false)
  const [editFormula, setEditFormula] = useState<Formula | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <PageTransition className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Formulas</h1>
          <p className="text-sm text-muted-foreground">
            Define reusable math and logic expressions for your game.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Formula
        </Button>
      </div>

      {formulas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12">
            <FunctionSquare className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium mb-1">No formulas yet</p>
            <p className="text-xs text-muted-foreground mb-4">Create your first formula to define game calculations</p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Formula
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {formulas.map((formula) => (
            <Card key={formula.id} className="group p-3 sm:p-4 overflow-hidden transition-all duration-200 hover:border-primary/20 hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_2px_10px_rgba(255,255,255,0.04)]">
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-0">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors bg-violet-500/10 text-violet-500 border-violet-500/30">
                    <FunctionSquare className="h-6 w-6" />
                  </div>

                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <code className="text-base font-bold tracking-tight truncate">{formula.name}</code>
                      <Badge variant="secondary" className={cn(
                        'text-xs h-6 px-2.5 border-0 font-medium shrink-0',
                        formula.outputMode === 'method'
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'bg-amber-500/10 text-amber-500',
                      )}>
                        {formula.outputMode === 'method' ? 'Method' : 'Lookup'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground font-medium">
                      <span className="font-mono truncate max-w-[300px]">{formula.expression}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                      <span>{formula.variables.length} var{formula.variables.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pl-[58px] sm:pl-0 shrink-0">
                  <Button size="icon" variant="outline" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => setEditFormula(formula)} title="Edit">
                    <Pencil className="h-[18px] w-[18px]" />
                  </Button>
                  <Button
                    size="icon" variant="outline" className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      await deleteMut.mutateAsync(formula.id)
                      toast.success(`Deleted "${formula.name}"`)
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-[18px] w-[18px]" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FormulaDialog open={createOpen} onOpenChange={setCreateOpen} projectId={projectId} formula={null} />
      <FormulaDialog open={!!editFormula} onOpenChange={(v) => { if (!v) setEditFormula(null) }} projectId={projectId} formula={editFormula} />
    </PageTransition>
  )
}
