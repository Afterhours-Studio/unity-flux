import { createFileRoute, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import type { DataEntry, Schema, SchemaField } from '@/types/project'

export const Route = createFileRoute('/projects/$projectId/entries')({
  component: EntriesPage,
})

type Environment = 'development' | 'staging' | 'production'

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: SchemaField
  value: unknown
  onChange: (val: unknown) => void
}) {
  switch (field.type) {
    case 'boolean':
      return (
        <Switch
          checked={!!value}
          onCheckedChange={onChange}
        />
      )
    case 'integer':
      return (
        <Input
          type="number"
          step={1}
          min={field.min}
          max={field.max}
          value={value as number ?? 0}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="w-32"
        />
      )
    case 'float':
      return (
        <Input
          type="number"
          step={0.1}
          min={field.min}
          max={field.max}
          value={value as number ?? 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-32"
        />
      )
    case 'enum':
      return (
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {field.values?.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case 'color':
      return (
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={(value as string) ?? '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-8 rounded cursor-pointer"
          />
          <Input
            value={(value as string) ?? '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="w-28 font-mono text-sm"
          />
        </div>
      )
    default:
      return (
        <Input
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
        />
      )
  }
}

function EntryDialog({
  open,
  onOpenChange,
  schema,
  environment,
  editEntry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  schema: Schema
  environment: Environment
  editEntry?: DataEntry
}) {
  const addEntry = useProjectStore((s) => s.addEntry)
  const updateEntry = useProjectStore((s) => s.updateEntry)
  const [data, setData] = useState<Record<string, unknown>>(editEntry?.data ?? {})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editEntry) {
      updateEntry(editEntry.id, data)
      toast.success('Entry updated')
    } else {
      addEntry(schema.id, data, environment)
      toast.success('Entry created')
    }
    setData({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editEntry ? 'Edit Entry' : 'New Entry'}</DialogTitle>
            <DialogDescription>
              {schema.name} — {environment}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {schema.fields.map((field) => (
              <div key={field.name} className="grid gap-1.5">
                <Label className="text-sm">
                  {field.name}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                  <Badge variant="outline" className="ml-2 text-[10px]">{field.type}</Badge>
                </Label>
                <FieldInput
                  field={field}
                  value={data[field.name]}
                  onChange={(val) => setData({ ...data, [field.name]: val })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editEntry ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EntriesPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/entries' })
  const schemas = useProjectStore(
    useShallow((s) => s.schemas.filter((sc) => sc.projectId === projectId)),
  )
  const allEntries = useProjectStore((s) => s.entries)
  const deleteEntry = useProjectStore((s) => s.deleteEntry)
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>('')
  const [env, setEnv] = useState<Environment>('development')
  const [createOpen, setCreateOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<DataEntry | undefined>()

  const selectedSchema = schemas.find((s) => s.id === selectedSchemaId)
  const entries = allEntries.filter(
    (e) => e.schemaId === selectedSchemaId && e.environment === env,
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Editor</h1>
        <p className="text-muted-foreground mt-1">
          Manage configuration entries for your schemas.
        </p>
      </div>

      {schemas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-sm">
              Create schemas first before adding data entries.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Controls */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Schema</Label>
              <Select value={selectedSchemaId} onValueChange={setSelectedSchemaId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select a schema..." />
                </SelectTrigger>
                <SelectContent>
                  {schemas.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Environment</Label>
              <Tabs value={env} onValueChange={(v) => setEnv(v as Environment)}>
                <TabsList>
                  <TabsTrigger value="development">Dev</TabsTrigger>
                  <TabsTrigger value="staging">Staging</TabsTrigger>
                  <TabsTrigger value="production">Prod</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {selectedSchema && (
              <div className="ml-auto">
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Entry
                </Button>
              </div>
            )}
          </div>

          {/* Data Table */}
          {selectedSchema && (
            entries.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground text-sm mb-4">
                    No entries for "{selectedSchema.name}" in {env}.
                  </p>
                  <Button onClick={() => setCreateOpen(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectedSchema.fields.map((f) => (
                        <TableHead key={f.name}>{f.name}</TableHead>
                      ))}
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        {selectedSchema.fields.map((f) => (
                          <TableCell key={f.name} className="font-mono text-sm">
                            {f.type === 'boolean'
                              ? entry.data[f.name] ? 'true' : 'false'
                              : f.type === 'color'
                                ? (
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="h-4 w-4 rounded border"
                                        style={{ backgroundColor: entry.data[f.name] as string }}
                                      />
                                      {String(entry.data[f.name] ?? '')}
                                    </div>
                                  )
                                : String(entry.data[f.name] ?? '')}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditEntry(entry)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                deleteEntry(entry.id)
                                toast.success('Entry deleted')
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )
          )}

          {selectedSchema && (
            <>
              <EntryDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                schema={selectedSchema}
                environment={env}
              />
              {editEntry && (
                <EntryDialog
                  open={!!editEntry}
                  onOpenChange={(open) => { if (!open) setEditEntry(undefined) }}
                  schema={selectedSchema}
                  environment={env}
                  editEntry={editEntry}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
