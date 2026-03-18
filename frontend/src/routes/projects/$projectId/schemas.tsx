import { createFileRoute, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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
import { useProjectStore } from '@/stores/project-store'
import { toast } from 'sonner'
import type { SchemaField } from '@/types/project'

export const Route = createFileRoute('/projects/$projectId/schemas')({
  component: SchemasPage,
})

const FIELD_TYPES = ['string', 'integer', 'float', 'boolean', 'enum', 'color'] as const

function SchemaDialog({
  open,
  onOpenChange,
  projectId,
  editSchema,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  editSchema?: { id: string; name: string; fields: SchemaField[] }
}) {
  const addSchema = useProjectStore((s) => s.addSchema)
  const updateSchema = useProjectStore((s) => s.updateSchema)
  const [name, setName] = useState(editSchema?.name ?? '')
  const [fields, setFields] = useState<SchemaField[]>(editSchema?.fields ?? [])

  const addField = () => {
    setFields([...fields, { name: '', type: 'string', required: false }])
  }

  const updateField = (index: number, updates: Partial<SchemaField>) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)))
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || fields.length === 0) {
      toast.error('Schema needs a name and at least one field')
      return
    }
    const validFields = fields.filter((f) => f.name.trim())
    if (validFields.length === 0) {
      toast.error('At least one field must have a name')
      return
    }

    if (editSchema) {
      updateSchema(editSchema.id, { name: name.trim(), fields: validFields })
      toast.success('Schema updated')
    } else {
      addSchema(projectId, name.trim(), validFields)
      toast.success('Schema created')
    }
    setName('')
    setFields([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editSchema ? 'Edit Schema' : 'Create Schema'}</DialogTitle>
            <DialogDescription>
              Define the data structure for a game configuration group.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Schema Name</Label>
              <Input
                placeholder="e.g., EnemyStats, LevelConfig, Items"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fields</Label>
                <Button type="button" variant="outline" size="sm" onClick={addField}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Field
                </Button>
              </div>

              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No fields yet. Click "Add Field" to start.
                </p>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30">
                      <div className="flex-1 grid gap-2 sm:grid-cols-3">
                        <Input
                          placeholder="Field name"
                          value={field.name}
                          onChange={(e) => updateField(i, { name: e.target.value })}
                        />
                        <Select
                          value={field.type}
                          onValueChange={(v) => updateField(i, { type: v as SchemaField['type'] })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={field.required}
                            onCheckedChange={(v) => updateField(i, { required: v })}
                          />
                          <Label className="text-xs">Required</Label>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => removeField(i)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live preview */}
            {fields.some((f) => f.name.trim()) && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">JSON Preview</Label>
                <pre className="bg-muted p-3 rounded-lg text-xs font-mono overflow-x-auto">
                  {JSON.stringify(
                    Object.fromEntries(
                      fields
                        .filter((f) => f.name.trim())
                        .map((f) => {
                          const defaults: Record<string, unknown> = {
                            string: '',
                            integer: 0,
                            float: 0.0,
                            boolean: false,
                            enum: f.values?.[0] ?? '',
                            color: '#000000',
                          }
                          return [f.name, defaults[f.type]]
                        }),
                    ),
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || fields.length === 0}>
              {editSchema ? 'Save Changes' : 'Create Schema'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SchemasPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/schemas' })
  const schemas = useProjectStore(
    useShallow((s) => s.schemas.filter((sc) => sc.projectId === projectId)),
  )
  const deleteSchema = useProjectStore((s) => s.deleteSchema)
  const [createOpen, setCreateOpen] = useState(false)
  const [editSchema, setEditSchema] = useState<{ id: string; name: string; fields: SchemaField[] } | undefined>()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schemas</h1>
          <p className="text-muted-foreground mt-1">
            Define the data structures for your game configurations.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Schema
        </Button>
      </div>

      {schemas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-sm mb-4">No schemas defined yet.</p>
            <Button onClick={() => setCreateOpen(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create First Schema
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schemas.map((schema) => (
            <Card key={schema.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <button
                    className="flex items-center gap-2 text-left"
                    onClick={() => toggleExpand(schema.id)}
                  >
                    {expanded.has(schema.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <CardTitle className="text-base">{schema.name}</CardTitle>
                    <Badge variant="secondary" className="ml-2">
                      {schema.fields.length} fields
                    </Badge>
                  </button>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditSchema(schema)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        deleteSchema(schema.id)
                        toast.success('Schema deleted')
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {expanded.has(schema.id) && (
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Required</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schema.fields.map((field, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">{field.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{field.type}</Badge>
                          </TableCell>
                          <TableCell>{field.required ? 'Yes' : 'No'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <SchemaDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
      />
      {editSchema && (
        <SchemaDialog
          open={!!editSchema}
          onOpenChange={(open) => { if (!open) setEditSchema(undefined) }}
          projectId={projectId}
          editSchema={editSchema}
        />
      )}
    </div>
  )
}
