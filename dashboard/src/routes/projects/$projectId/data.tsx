import { createFileRoute, useParams } from '@tanstack/react-router'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Columns3,
  Database,
  Upload,
  Download,
  Rocket,
  AlertTriangle,
  Check,
  ChevronDown,
  X,
  Loader2,
  Pencil,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useSchemas, useCreateSchema, useUpdateSchema, useDeleteSchema } from '@/hooks/use-schemas'
import { useEntries, useCreateEntry, useUpdateEntry, useDeleteEntry } from '@/hooks/use-entries'
import { usePublishVersion } from '@/hooks/use-versions'
import { toast } from 'sonner'
import type { SchemaField } from '@/types/project'
import { PageTransition } from '@/components/motion'
import { TABLE_TEMPLATES } from '@/lib/table-templates'
import { HexColorPicker } from 'react-colorful'
import { validateSchema, getCellErrors, type ValidationError } from '@/lib/validation'

export const Route = createFileRoute('/projects/$projectId/data')({
  component: DataPage,
})

const FIELD_TYPES = [
  'string',
  'integer',
  'float',
  'boolean',
  'enum',
  'list',
  'color',
  'config',
] as const

function getDefaultValue(field: SchemaField): unknown {
  switch (field.type) {
    case 'string':
      return ''
    case 'integer':
      return 0
    case 'float':
      return 0
    case 'boolean':
      return false
    case 'enum':
      return field.values?.[0] ?? ''
    case 'list':
      return ''
    case 'color':
      return '#000000'
    case 'config':
      return 'string'
  }
}

/* ═══════════════════════════════════════════════
   OptionSelect — dropdown with inline add
   enum = single select, list = multi select
   ═══════════════════════════════════════════════ */

function OptionSelect({
  options,
  value,
  onChange,
  onAddOption,
  onRemoveOption,
  multi = false,
  allowAdd = true,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  onAddOption: (v: string) => void
  onRemoveOption?: (v: string) => void
  multi?: boolean
  allowAdd?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newVal, setNewVal] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  // Click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return
      setOpen(false)
      setAdding(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Position: fixed to escape overflow
  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen((v) => !v)
  }

  const selectedSet = multi
    ? new Set(
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    : null

  const display = multi
    ? selectedSet!.size > 0
      ? Array.from(selectedSet!).join(', ')
      : 'Select…'
    : value || 'Select…'

  const confirmAdd = () => {
    if (newVal.trim()) {
      onAddOption(newVal.trim())
      if (!multi) onChange(newVal.trim())
      setNewVal('')
      setAdding(false)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        className="flex items-center justify-between h-8 w-full px-2.5 text-sm rounded-md border border-input bg-transparent hover:bg-accent/50 transition-colors text-left gap-1"
      >
        <span
          className={cn(
            'truncate',
            !value && 'text-muted-foreground',
          )}
        >
          {display}
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-muted-foreground shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed z-[100] min-w-[200px] border rounded-lg bg-popover shadow-lg animate-in fade-in-0 zoom-in-95"
          style={{ top: pos.top, left: pos.left }}
        >
          {options.length > 0 && (
            <div className="max-h-48 overflow-y-auto p-1">
              {options.map((opt) => {
                const selected = multi
                  ? selectedSet!.has(opt)
                  : value === opt
                return (
                  <div
                    key={opt}
                    className="flex items-center group rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (multi) {
                          const next = new Set(selectedSet!)
                          if (next.has(opt)) next.delete(opt)
                          else next.add(opt)
                          onChange(Array.from(next).join(','))
                        } else {
                          onChange(opt)
                          setOpen(false)
                        }
                      }}
                      className="flex items-center gap-2 flex-1 px-2 py-1.5 text-sm text-left"
                    >
                      {multi ? (
                        <div
                          className={cn(
                            'h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0',
                            selected
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground/30',
                          )}
                        >
                          {selected && (
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          )}
                        </div>
                      ) : (
                        <div className="w-3.5 shrink-0">
                          {selected && (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                      )}
                      <span className="truncate">{opt}</span>
                    </button>
                    {onRemoveOption && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveOption(opt)
                          // Clear value if removed option was selected
                          if (!multi && value === opt) onChange('')
                          if (multi && selectedSet?.has(opt)) {
                            const next = new Set(selectedSet)
                            next.delete(opt)
                            onChange(Array.from(next).join(','))
                          }
                        }}
                        className="p-1 mr-1 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {allowAdd && (
            <div className={cn(options.length > 0 && 'border-t', 'p-1')}>
              {adding ? (
                <div className="flex gap-1 p-0.5">
                  <Input
                    value={newVal}
                    onChange={(e) => setNewVal(e.target.value)}
                    placeholder="New option"
                    className="h-7 text-xs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        confirmAdd()
                      }
                      if (e.key === 'Escape') setAdding(false)
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={confirmAdd}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-sm hover:bg-accent transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add option
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

const CONFIG_TYPES = ['string', 'int', 'float', 'bool', 'enum', 'list', 'color']

/* ═══════════════════════════════════════════════
   ColorCellEditor — popup color picker
   ═══════════════════════════════════════════════ */

function ColorCellEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 h-8 rounded-sm hover:bg-muted/50 transition-colors w-full"
      >
        <div
          className="h-5 w-5 rounded border border-border shrink-0"
          style={{ backgroundColor: value }}
        />
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 p-3 bg-popover border rounded-lg shadow-lg">
          <HexColorPicker color={value} onChange={onChange} />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-2 h-7 text-xs font-mono"
          />
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   CellEditor — standard column type editors
   ═══════════════════════════════════════════════ */

function CellEditor({
  field,
  value,
  onChange,
  onAddOption,
  onRemoveOption,
}: {
  field: SchemaField
  value: unknown
  onChange: (val: unknown) => void
  onAddOption?: (opt: string) => void
  onRemoveOption?: (opt: string) => void
}) {
  const base =
    'h-8 border-0 bg-transparent px-2 rounded-sm text-sm focus:bg-background focus:ring-1 focus:ring-ring'

  switch (field.type) {
    case 'boolean':
      return (
        <Select value={String(!!value)} onValueChange={(v) => onChange(v === 'true')}>
          <SelectTrigger className={cn(base, 'w-full')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">true</SelectItem>
            <SelectItem value="false">false</SelectItem>
          </SelectContent>
        </Select>
      )
    case 'integer':
      return (
        <Input
          value={String((value as number) ?? 0)}
          onChange={(e) => {
            const v = e.target.value
            if (v === '' || v === '-') return onChange(v)
            const n = parseInt(v)
            if (!isNaN(n)) onChange(n)
          }}
          className={cn(base, 'w-24 font-mono tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')}
        />
      )
    case 'float':
      return (
        <Input
          value={String((value as number) ?? 0)}
          onChange={(e) => {
            const v = e.target.value
            if (v === '' || v === '-' || v === '.') return onChange(v)
            const n = parseFloat(v)
            if (!isNaN(n)) onChange(n)
          }}
          className={cn(base, 'w-24 font-mono tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')}
        />
      )
    case 'enum':
      return (
        <OptionSelect
          options={field.values ?? []}
          value={String(value ?? '')}
          onChange={(v) => onChange(v)}
          onAddOption={(opt) => onAddOption?.(opt)}
          onRemoveOption={(opt) => onRemoveOption?.(opt)}
        />
      )
    case 'list':
      return (
        <OptionSelect
          options={field.values ?? []}
          value={String(value ?? '')}
          onChange={(v) => onChange(v)}
          onAddOption={(opt) => onAddOption?.(opt)}
          onRemoveOption={(opt) => onRemoveOption?.(opt)}
          multi
        />
      )
    case 'color':
      return <ColorCellEditor value={(value as string) ?? '#000000'} onChange={(v) => onChange(v)} />
    default:
      return (
        <Input
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…"
          className={cn(base, 'w-full min-w-[120px]')}
        />
      )
  }
}

/* ═══════════════════════════════════════════════
   ConfigValueEditor — config column type
   reads another column per-row to decide editor
   ═══════════════════════════════════════════════ */

function ConfigValueEditor({
  rowType,
  fieldName,
  data,
  onDataChange,
}: {
  rowType: string
  fieldName: string
  data: Record<string, unknown>
  onDataChange: (d: Record<string, unknown>) => void
}) {
  const value = data[fieldName]
  const raw = String(value ?? '')
  const options = String(data._options ?? '')

  const setValue = (v: unknown) => onDataChange({ ...data, [fieldName]: v })
  const base =
    'h-8 border-0 bg-transparent px-2 rounded-sm text-sm focus:bg-background focus:ring-1 focus:ring-ring'

  switch (rowType) {
    case 'int': {
      const valid = raw === '' || /^-?\d+$/.test(raw)
      return (
        <div className="relative">
          <Input
            value={raw}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className={cn(base, 'w-full font-mono')}
          />
          {!valid && raw !== '' && (
            <AlertTriangle className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-500" />
          )}
        </div>
      )
    }
    case 'float': {
      const valid = raw === '' || /^-?\d+(\.\d+)?$/.test(raw)
      return (
        <div className="relative">
          <Input
            value={raw}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.0"
            className={cn(base, 'w-full font-mono')}
          />
          {!valid && raw !== '' && (
            <AlertTriangle className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-500" />
          )}
        </div>
      )
    }
    case 'bool':
      return (
        <Select value={raw === 'true' ? 'true' : 'false'} onValueChange={(v) => setValue(v)}>
          <SelectTrigger className={cn(base, 'w-full')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">true</SelectItem>
            <SelectItem value="false">false</SelectItem>
          </SelectContent>
        </Select>
      )
    case 'enum':
    case 'list': {
      const multi = rowType === 'list'
      const opts = options
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      if (opts.length === 0) {
        // Define mode
        return (
          <div className="flex items-center gap-1">
            <Input
              value={raw}
              onChange={(e) => setValue(e.target.value)}
              placeholder={multi ? 'pvp, co-op, solo' : 'easy, medium, hard'}
              className={cn(base, 'flex-1 min-w-[140px]')}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-primary"
              disabled={!raw.includes(',')}
              onClick={() => {
                const parsed = raw
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                if (parsed.length > 0) {
                  onDataChange({
                    ...data,
                    _options: parsed.join(','),
                    value: multi ? parsed.join(',') : parsed[0],
                  })
                }
              }}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      }

      // Select mode
      return (
        <OptionSelect
          options={opts}
          value={raw}
          onChange={(v) => setValue(v)}
          onAddOption={(opt) => {
            const newOpts = [...opts, opt]
            onDataChange({ ...data, _options: newOpts.join(',') })
          }}
          onRemoveOption={(opt) => {
            const newOpts = opts.filter((o) => o !== opt)
            if (newOpts.length === 0) {
              onDataChange({ ...data, _options: '', [fieldName]: '' })
            } else {
              const newData: Record<string, unknown> = { ...data, _options: newOpts.join(',') }
              if (!multi && raw === opt) newData[fieldName] = newOpts[0]
              if (multi) {
                const sel = raw.split(',').filter((s) => s.trim() !== opt)
                newData[fieldName] = sel.join(',')
              }
              onDataChange(newData)
            }
          }}
          multi={multi}
        />
      )
    }
    case 'color':
      return (
        <div className="flex items-center gap-1.5 px-1 h-8">
          <input
            type="color"
            value={raw || '#000000'}
            onChange={(e) => setValue(e.target.value)}
            className="h-6 w-6 rounded cursor-pointer border-0 p-0"
          />
          <span className="font-mono text-xs text-muted-foreground">
            {raw || '#000000'}
          </span>
        </div>
      )
    default:
      return (
        <Input
          value={raw}
          onChange={(e) => setValue(e.target.value)}
          placeholder="…"
          className={cn(base, 'w-full min-w-[120px]')}
        />
      )
  }
}

/* ═══════════════════════════════════════════════
   Column dialog (add / edit)
   ═══════════════════════════════════════════════ */

function ColumnDialog({
  open,
  onOpenChange,
  onSave,
  onDelete,
  editField,
  siblingFields,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (field: SchemaField) => void
  onDelete?: () => void
  editField?: SchemaField
  siblingFields?: SchemaField[]
}) {
  const [name, setName] = useState(editField?.name ?? '')
  const [type, setType] = useState<SchemaField['type']>(
    editField?.type ?? 'string',
  )
  const [required, setRequired] = useState(editField?.required ?? false)
  const [enumValues, setEnumValues] = useState(
    editField?.values?.join(', ') ?? '',
  )
  const [configRef, setConfigRef] = useState(editField?.configRef ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const field: SchemaField = { name: name.trim(), type, required }
    if (type === 'enum' || type === 'list') {
      field.values = enumValues
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    }
    if (type === 'config') {
      field.configRef = configRef
    }
    onSave(field)
    onOpenChange(false)
  }

  const refOptions = (siblingFields ?? []).filter(
    (f) => f.name !== editField?.name,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>
              {editField ? 'Edit Column' : 'Add Column'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g., hp, damage, name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as SchemaField['type'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(type === 'enum' || type === 'list') && (
              <div className="grid gap-2">
                <Label>
                  Initial values{' '}
                  <span className="text-muted-foreground font-normal">
                    (can add more inline later)
                  </span>
                </Label>
                <Input
                  placeholder="e.g., easy, medium, hard"
                  value={enumValues}
                  onChange={(e) => setEnumValues(e.target.value)}
                />
              </div>
            )}
            {type === 'config' && (
              <div className="grid gap-2">
                <Label>Drives Column</Label>
                <Select value={configRef} onValueChange={setConfigRef}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column…" />
                  </SelectTrigger>
                  <SelectContent>
                    {refOptions.map((f) => (
                      <SelectItem key={f.name} value={f.name}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This column becomes a type selector. The driven
                  column's editor changes per row.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={required} onCheckedChange={setRequired} />
              <Label>Required</Label>
            </div>
            {editField && onDelete && (
              <>
                <Separator />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive w-full justify-start"
                  onClick={() => {
                    onDelete()
                    onOpenChange(false)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete column
                </Button>
              </>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !name.trim() || (type === 'config' && !configRef)
              }
            >
              {editField ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════
   Create table dialog — template chooser
   ═══════════════════════════════════════════════ */

function CreateTableDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (
    name: string,
    mode: 'data' | 'config',
    fields?: SchemaField[],
    sampleRows?: Record<string, unknown>[],
  ) => void
}) {
  const [name, setName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(
    'config-params',
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const tpl = TABLE_TEMPLATES.find((t) => t.id === selectedTemplate)
    onSave(
      name.trim(),
      tpl?.mode ?? 'data',
      tpl?.fields,
      tpl?.sampleRows,
    )
    setName('')
    setSelectedTemplate('config-params')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>New Table</DialogTitle>
            <DialogDescription>
              Choose a template and name your table.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div className="grid gap-2">
              <Label>Table Name</Label>
              <Input
                placeholder="e.g., GameSettings, EnemyStats"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Template</Label>
              <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
                {/* Blank table option */}
                <button
                  key="blank"
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  className={cn(
                    'flex flex-col gap-1 p-3 border rounded-lg text-left transition-colors',
                    selectedTemplate === null
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50',
                  )}
                >
                  <p className="text-xs font-medium">Blank Table</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Empty table, add columns manually
                  </p>
                </button>
                {/* Templates from library */}
                {TABLE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(tpl.id)
                      if (!name.trim()) setName(tpl.name.replace(/\s+\/\s+/g, ''))
                    }}
                    className={cn(
                      'flex flex-col gap-1 p-3 border rounded-lg text-left transition-colors',
                      selectedTemplate === tpl.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium">{tpl.name}</p>
                      {tpl.mode === 'config' && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0"
                        >
                          config
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
                      {tpl.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {tpl.fields.length} cols
                      {tpl.sampleRows?.length
                        ? ` · ${tpl.sampleRows.length} sample rows`
                        : ''}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════
   Publish dialog
   ═══════════════════════════════════════════════ */

const ENV_OPTIONS = [
  {
    value: 'development' as const,
    label: 'Development',
    desc: 'For testing in development builds',
  },
  {
    value: 'staging' as const,
    label: 'Staging',
    desc: 'Pre-production testing environment',
  },
  {
    value: 'production' as const,
    label: 'Production',
    desc: 'Live environment — affects all players',
  },
]

function PublishDialog({
  open,
  onOpenChange,
  onPublish,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPublish: (env: 'development' | 'staging' | 'production') => void
}) {
  const [env, setEnv] = useState<'development' | 'staging' | 'production'>(
    'staging',
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Publish Version</DialogTitle>
          <DialogDescription>
            Snapshot all tables and deploy to an environment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 py-4">
          <Label>Target Environment</Label>
          <div className="space-y-2">
            {ENV_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEnv(opt.value)}
                className={cn(
                  'flex items-center gap-3 p-3 border rounded-lg text-left w-full transition-colors',
                  env === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50',
                  opt.value === 'production' &&
                  env === opt.value &&
                  'border-destructive bg-destructive/5',
                )}
              >
                <div
                  className={cn(
                    'h-4 w-4 rounded-full border-2 shrink-0 transition-colors',
                    env === opt.value
                      ? opt.value === 'production'
                        ? 'border-destructive bg-destructive'
                        : 'border-primary bg-primary'
                      : 'border-muted-foreground/30',
                  )}
                />
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
          {env === 'production' && (
            <div className="flex gap-2 items-start bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Publishing to production will immediately update the live
                configuration for all players.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="px-6 pb-6 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={env === 'production' ? 'destructive' : 'default'}
            onClick={() => {
              onPublish(env)
              onOpenChange(false)
            }}
          >
            <Rocket className="h-4 w-4 mr-2" />
            Publish to {env}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════
   Main page
   ═══════════════════════════════════════════════ */

function DataPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/data' })
  const { data: schemas = [] } = useSchemas(projectId)
  const createSchemaMut = useCreateSchema()
  const updateSchemaMut = useUpdateSchema()
  const deleteSchemaMut = useDeleteSchema()
  const createEntryMut = useCreateEntry()
  const updateEntryMut = useUpdateEntry()
  const deleteEntryMut = useDeleteEntry()
  const publishVersionMut = usePublishVersion()

  const [selectedId, setSelectedId] = useState('')
  const [createTableOpen, setCreateTableOpen] = useState(false)
  const [addColumnOpen, setAddColumnOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [editColumn, setEditColumn] = useState<{
    index: number
    field: SchemaField
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Deferred save: buffer cell edits and table renames locally
  const [dirtyEntries, setDirtyEntries] = useState<Map<string, Map<string, Record<string, unknown>>>>(new Map())
  const [dirtyNames, setDirtyNames] = useState<Map<string, string>>(new Map())

  const activeId = selectedId || schemas[0]?.id || ''
  const selectedSchema = schemas.find((s) => s.id === activeId)
  const { data: serverEntries = [] } = useEntries(activeId)

  // Merge server entries with local dirty overrides
  const entries = serverEntries.map((e) => {
    const schemaOverrides = dirtyEntries.get(activeId)
    const override = schemaOverrides?.get(e.id)
    return override ? { ...e, data: { ...e.data, ...override } } : e
  })

  // Validation errors for current table
  const validationErrors: ValidationError[] = selectedSchema
    ? validateSchema(entries, selectedSchema)
    : []
  const errorCount = validationErrors.filter((e) => e.severity === 'error').length

  // Map: fieldName → config column name that drives it
  const configDriverMap = new Map<string, string>()
  selectedSchema?.fields.forEach((f) => {
    if (f.type === 'config' && f.configRef) {
      configDriverMap.set(f.configRef, f.name)
    }
  })

  /* ── handlers ── */

  const handleCreateTable = async (
    name: string,
    mode: 'data' | 'config',
    templateFields?: SchemaField[],
    sampleRows?: Record<string, unknown>[],
  ) => {
    try {
      const schema = await createSchemaMut.mutateAsync({ projectId, name, fields: templateFields ?? [], mode })
      if (sampleRows?.length) {
        for (const row of sampleRows) {
          await createEntryMut.mutateAsync({ schemaId: schema.id, data: row, environment: 'development' })
        }
      }
      setSelectedId(schema.id)
      toast.success(`Table "${name}" created`)
    } catch (err) {
      toast.error(`Failed to create table: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleAddRow = async () => {
    if (!selectedSchema) return
    const defaults: Record<string, unknown> = {}
    selectedSchema.fields.forEach((f) => {
      defaults[f.name] = getDefaultValue(f)
    })
    try {
      await createEntryMut.mutateAsync({ schemaId: selectedSchema.id, data: defaults, environment: 'development' })
    } catch (err) {
      toast.error(`Failed to add row: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleCellChange = (
    entryId: string,
    fieldName: string,
    value: unknown,
  ) => {
    if (!activeId) return
    setDirtyEntries((prev) => {
      const next = new Map(prev)
      const schemaMap = new Map(next.get(activeId) ?? [])
      const existing = schemaMap.get(entryId) ?? {}
      schemaMap.set(entryId, { ...existing, [fieldName]: value })
      next.set(activeId, schemaMap)
      return next
    })
  }

  const handleRowDataChange = (
    entryId: string,
    newData: Record<string, unknown>,
  ) => {
    if (!activeId) return
    setDirtyEntries((prev) => {
      const next = new Map(prev)
      const schemaMap = new Map(next.get(activeId) ?? [])
      schemaMap.set(entryId, newData)
      next.set(activeId, schemaMap)
      return next
    })
  }

  const handleAddEnumOption = async (fieldName: string, newOption: string) => {
    if (!selectedSchema) return
    const newFields = selectedSchema.fields.map((f) => {
      if (f.name === fieldName) {
        return { ...f, values: [...(f.values ?? []), newOption] }
      }
      return f
    })
    try {
      await updateSchemaMut.mutateAsync({ id: selectedSchema.id, updates: { fields: newFields } })
    } catch (err) {
      toast.error(`Failed to add enum option: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleRemoveEnumOption = async (
    fieldName: string,
    optToRemove: string,
  ) => {
    if (!selectedSchema) return
    const newFields = selectedSchema.fields.map((f) => {
      if (f.name === fieldName) {
        return {
          ...f,
          values: (f.values ?? []).filter((v) => v !== optToRemove),
        }
      }
      return f
    })
    try {
      await updateSchemaMut.mutateAsync({ id: selectedSchema.id, updates: { fields: newFields } })
    } catch (err) {
      toast.error(`Failed to remove enum option: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleAddColumn = async (field: SchemaField) => {
    if (!selectedSchema) return
    try {
      await updateSchemaMut.mutateAsync({ id: selectedSchema.id, updates: { fields: [...selectedSchema.fields, field] } })
      toast.success(`Column "${field.name}" added`)
    } catch (err) {
      toast.error(`Failed to add column: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleUpdateColumn = async (index: number, field: SchemaField) => {
    if (!selectedSchema) return
    try {
      const oldName = selectedSchema.fields[index].name
      const newFields = selectedSchema.fields.map((f, i) =>
        i === index ? field : f,
      )
      await updateSchemaMut.mutateAsync({ id: selectedSchema.id, updates: { fields: newFields } })
      if (oldName !== field.name) {
        for (const entry of entries.filter((e) => e.schemaId === selectedSchema.id)) {
          if (oldName in entry.data) {
            const d = { ...entry.data }
            d[field.name] = d[oldName]
            delete d[oldName]
            await updateEntryMut.mutateAsync({ id: entry.id, data: d })
          }
        }
      }
      toast.success('Column updated')
    } catch (err) {
      toast.error(`Failed to update column: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleDeleteColumn = async (index: number) => {
    if (!selectedSchema) return
    const name = selectedSchema.fields[index].name
    try {
      await updateSchemaMut.mutateAsync({ id: selectedSchema.id, updates: { fields: selectedSchema.fields.filter((_, i) => i !== index) } })
      toast.success(`Column "${name}" deleted`)
    } catch (err) {
      toast.error(`Failed to delete column: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleDeleteTable = async () => {
    if (!selectedSchema) return
    const name = selectedSchema.name
    try {
      await deleteSchemaMut.mutateAsync(selectedSchema.id)
      // Clean up dirty state for deleted table
      setDirtyEntries((prev) => { const next = new Map(prev); next.delete(selectedSchema.id); return next })
      setDirtyNames((prev) => { const next = new Map(prev); next.delete(selectedSchema.id); return next })
      setSelectedId('')
      toast.success(`Table "${name}" deleted`)
    } catch (err) {
      toast.error(`Failed to delete table: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const [renamingId, setRenamingId] = useState<string | null>(null)

  const handleRenameTable = () => {
    if (!selectedSchema) return
    setRenamingId(selectedSchema.id)
  }

  const commitRename = (schemaId: string, value: string) => {
    const schema = schemas.find((s) => s.id === schemaId)
    const trimmed = value.trim()
    if (trimmed && trimmed !== schema?.name) {
      setDirtyNames((prev) => {
        const next = new Map(prev)
        next.set(schemaId, trimmed)
        return next
      })
    } else {
      // Revert: remove from dirty if same as original
      setDirtyNames((prev) => {
        const next = new Map(prev)
        next.delete(schemaId)
        return next
      })
    }
    setRenamingId(null)
  }

  const handleSave = async () => {
    try {
      // Save dirty entry edits
      for (const [schemaId, entryMap] of dirtyEntries) {
        for (const [entryId, patchData] of entryMap) {
          const entry = (schemaId === activeId ? serverEntries : []).find((e) => e.id === entryId)
          if (entry) {
            await updateEntryMut.mutateAsync({ id: entryId, data: { ...entry.data, ...patchData } })
          }
        }
      }
      // Save dirty table renames
      for (const [schemaId, newName] of dirtyNames) {
        await updateSchemaMut.mutateAsync({ id: schemaId, updates: { name: newName } })
      }
      setDirtyEntries(new Map())
      setDirtyNames(new Map())
      toast.success('All changes saved')
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // Ctrl+S to save
  const hasDirty = dirtyEntries.size > 0 || dirtyNames.size > 0
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (hasDirty) handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hasDirty])

  const handlePublish = async (
    env: 'development' | 'staging' | 'production',
  ) => {
    try {
      const version = await publishVersionMut.mutateAsync({ projectId, environment: env })
      toast.success(`Published ${version.versionTag} to ${env}`)
    } catch (err) {
      toast.error(`Failed to publish: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleExport = () => {
    if (!selectedSchema) return
    const headers = selectedSchema.fields.map((f) => f.name)
    const rows = entries.map((e) =>
      selectedSchema.fields
        .map((f) => {
          const str = String(e.data[f.name] ?? '')
          if (str.includes(',') || str.includes('"') || str.includes('\n'))
            return `"${str.replace(/"/g, '""')}"`
          return str
        })
        .join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedSchema.name}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedSchema) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const lines = text.trim().split('\n')
      if (lines.length < 2) return
      const headers = lines[0].split(',').map((h) => h.trim())
      let imported = 0
      try {
        for (const line of lines.slice(1)) {
          if (!line.trim()) continue
          const values = line.split(',').map((v) => v.trim())
          const data: Record<string, unknown> = {}
          selectedSchema!.fields.forEach((field) => {
            const col = headers.indexOf(field.name)
            if (col >= 0 && col < values.length) {
              const raw = values[col]
              switch (field.type) {
                case 'integer':
                  data[field.name] = parseInt(raw) || 0
                  break
                case 'float':
                  data[field.name] = parseFloat(raw) || 0
                  break
                case 'boolean':
                  data[field.name] = raw.toLowerCase() === 'true'
                  break
                default:
                  data[field.name] = raw
              }
            } else {
              data[field.name] = getDefaultValue(field)
            }
          })
          await createEntryMut.mutateAsync({ schemaId: selectedSchema!.id, data, environment: 'development' })
          imported++
        }
        toast.success(`Imported ${imported} rows`)
      } catch (err) {
        toast.error(`Import failed after ${imported} rows: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  /* ── render ── */

  return (
    <PageTransition className="p-6 space-y-5">
      {/* ── Row 1: title ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Blueprint</h1>
        <p className="text-muted-foreground mt-1">
          Define table schemas and configure game data.
        </p>
      </div>

      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />

      {schemas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Database className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tables yet</h3>
            <p className="text-muted-foreground text-sm mb-6 text-center max-w-sm">
              Create your first configuration table to start managing game
              data.
            </p>
            <Button onClick={() => setCreateTableOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Table
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Row 2: action buttons ── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {selectedSchema && (
                <Button variant="ghost" size="sm" onClick={handleRenameTable} title="Rename table">
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Rename
                </Button>
              )}
              {selectedSchema && selectedSchema.fields.length > 0 && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    Import
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleExport}>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export
                  </Button>
                </>
              )}
              {selectedSchema && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDeleteTable}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setCreateTableOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                New Table
              </Button>
              <Button variant="outline" size="sm" onClick={handleSave} disabled={dirtyEntries.size === 0 && dirtyNames.size === 0}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save
              </Button>
            </div>
          </div>

          {/* ── Row 3: table tabs ── */}
          <div className="flex items-center gap-0.5 bg-muted/50 p-1 rounded-lg overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {schemas.map((s) =>
              renamingId === s.id ? (
                <input
                  key={s.id}
                  autoFocus
                  defaultValue={dirtyNames.get(s.id) ?? s.name}
                  className="px-3 py-1.5 text-[13px] font-medium rounded-md bg-background text-foreground shadow-sm outline-none ring-1 ring-ring shrink-0 w-32"
                  onBlur={(e) => commitRename(s.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(s.id, e.currentTarget.value)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                />
              ) : (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  onDoubleClick={() => setRenamingId(s.id)}
                  className={cn(
                    'relative px-3 py-1.5 text-[13px] font-medium rounded-md transition-all duration-150 shrink-0',
                    activeId === s.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {dirtyNames.get(s.id) ?? s.name}
                  {(dirtyEntries.has(s.id) || dirtyNames.has(s.id)) && (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </button>
              ),
            )}
          </div>

          {/* ── table ── */}
          {selectedSchema &&
            (selectedSchema.fields.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Columns3 className="h-8 w-8 text-muted-foreground/20 mb-3" />
                  <p className="text-muted-foreground text-sm mb-4">
                    No columns yet. Add columns to start entering data.
                  </p>
                  <Button
                    onClick={() => setAddColumnOpen(true)}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Column
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
              {errorCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <span className="text-red-600 dark:text-red-400 text-xs">
                    {errorCount} validation {errorCount === 1 ? 'error' : 'errors'}
                  </span>
                </div>
              )}
              <div className="border rounded-lg overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-10 text-center text-xs">
                          #
                        </TableHead>
                        {selectedSchema.fields.map((field, i) => (
                          <TableHead
                            key={field.name}
                            className={cn(
                              'cursor-pointer hover:bg-muted/60 transition-colors',
                              field.type === 'config'
                                ? 'min-w-[180px] w-[180px]'
                                : 'min-w-[140px]',
                            )}
                            onClick={() =>
                              setEditColumn({ index: i, field })
                            }
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-xs">
                                {field.name}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 font-normal"
                              >
                                {field.type === 'config'
                                  ? `→ ${field.configRef}`
                                  : field.type}
                              </Badge>
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="w-24">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => setAddColumnOpen(true)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Column
                          </Button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={selectedSchema.fields.length + 2}
                            className="text-center py-8 text-sm text-muted-foreground"
                          >
                            No rows yet. Click "Add row" below.
                          </TableCell>
                        </TableRow>
                      ) : (
                        entries.map((entry, rowIdx) => (
                          <TableRow key={entry.id} className="group">
                            <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                              {rowIdx + 1}
                            </TableCell>
                            {selectedSchema.fields.map((field) => {
                              const cellErrors = getCellErrors(entry.id, field.name, validationErrors)
                              const hasError = cellErrors.some((e) => e.severity === 'error')
                              const hasWarning = !hasError && cellErrors.length > 0
                              return (
                              <TableCell
                                key={field.name}
                                className="p-1 relative"
                                title={cellErrors.map((e) => e.message).join('\n') || undefined}
                              >
                                {(hasError || hasWarning) && (
                                  <AlertTriangle className={cn(
                                    'pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10',
                                    hasError ? 'text-red-500' : 'text-amber-500',
                                  )} />
                                )}
                                {field.type === 'config' ? (
                                  /* Config column = type picker */
                                  <OptionSelect
                                    options={CONFIG_TYPES}
                                    value={String(entry.data[field.name] ?? 'string')}
                                    onChange={(v) =>
                                      handleCellChange(entry.id, field.name, v)
                                    }
                                    onAddOption={() => { }}
                                    allowAdd={false}
                                  />
                                ) : configDriverMap.has(field.name) ? (
                                  /* Config-driven column = dynamic editor */
                                  <ConfigValueEditor
                                    rowType={String(
                                      entry.data[configDriverMap.get(field.name)!] ?? 'string',
                                    )}
                                    fieldName={field.name}
                                    data={entry.data}
                                    onDataChange={(d) =>
                                      handleRowDataChange(entry.id, d)
                                    }
                                  />
                                ) : (
                                  /* Normal column */
                                  <CellEditor
                                    field={field}
                                    value={entry.data[field.name]}
                                    onChange={(val) =>
                                      handleCellChange(
                                        entry.id,
                                        field.name,
                                        val,
                                      )
                                    }
                                    onAddOption={(opt) =>
                                      handleAddEnumOption(field.name, opt)
                                    }
                                    onRemoveOption={(opt) =>
                                      handleRemoveEnumOption(
                                        field.name,
                                        opt,
                                      )
                                    }
                                  />
                                )}
                              </TableCell>
                              )
                            })}
                            <TableCell className="p-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={async () => {
                                  try {
                                    await deleteEntryMut.mutateAsync(entry.id)
                                    toast.success('Row deleted')
                                  } catch (err) {
                                    toast.error(`Failed to delete row: ${err instanceof Error ? err.message : 'Unknown error'}`)
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <button
                  onClick={handleAddRow}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 border-t transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add row
                </button>
              </div>
            </>
            ))}
        </>
      )}

      {/* ── dialogs ── */}
      <CreateTableDialog
        open={createTableOpen}
        onOpenChange={setCreateTableOpen}
        onSave={handleCreateTable}
      />
      <ColumnDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        onSave={handleAddColumn}
        siblingFields={selectedSchema?.fields}
      />
      {editColumn && (
        <ColumnDialog
          key={editColumn.index}
          open
          onOpenChange={(o) => {
            if (!o) setEditColumn(null)
          }}
          onSave={(field) => {
            handleUpdateColumn(editColumn.index, field)
            setEditColumn(null)
          }}
          onDelete={() => handleDeleteColumn(editColumn.index)}
          editField={editColumn.field}
          siblingFields={selectedSchema?.fields}
        />
      )}
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onPublish={handlePublish}
      />
    </PageTransition>
  )
}
