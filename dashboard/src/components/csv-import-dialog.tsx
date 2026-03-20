import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, AlertTriangle, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { parseCsv, coerceValue, type CsvParseResult } from '@/lib/csv-parser'

type Step = 'select' | 'preview' | 'importing'

interface CsvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schema: { fields: Array<{ name: string; type: string; default?: unknown }> } | null
  onImport: (rows: Record<string, unknown>[]) => Promise<void>
}

export function CsvImportDialog({ open, onOpenChange, schema, onImport }: CsvImportDialogProps) {
  const [step, setStep] = useState<Step>('select')
  const [parsed, setParsed] = useState<CsvParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const reset = () => {
    setStep('select')
    setParsed(null)
    setFileName('')
    setImporting(false)
    setImportResult(null)
  }

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const result = parseCsv(text)
      setParsed(result)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) handleFile(file)
  }, [])

  // Map CSV columns to schema fields, coerce types
  const mappedRows = parsed && schema ? parsed.rows.map(row => {
    const data: Record<string, unknown> = {}
    for (const field of schema.fields) {
      const csvVal = row[field.name]
      data[field.name] = coerceValue(csvVal ?? '', field.type, field.default)
    }
    return data
  }) : []

  // Find unmatched columns
  const matchedCols = schema ? schema.fields.filter(f => parsed?.headers.includes(f.name)) : []
  const unmatchedCsvCols = parsed ? parsed.headers.filter(h => !schema?.fields.some(f => f.name === h)) : []
  const unmatchedSchemaFields = schema ? schema.fields.filter(f => !parsed?.headers.includes(f.name)) : []

  const handleImport = async () => {
    if (!mappedRows.length) return
    setStep('importing')
    setImporting(true)
    try {
      await onImport(mappedRows)
      setImportResult({ success: mappedRows.length, errors: parsed?.errors ?? [] })
    } catch (err) {
      setImportResult({ success: 0, errors: [err instanceof Error ? err.message : 'Import failed'] })
    }
    setImporting(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="w-[95vw] sm:max-w-[700px] sm:w-[700px] flex flex-col p-0 max-h-[80vh]">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Import CSV</DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Select a CSV file to import rows.'}
            {step === 'preview' && `Preview: ${fileName} — ${parsed?.rows.length ?? 0} rows`}
            {step === 'importing' && (importing ? 'Importing...' : 'Import complete')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 'select' && (
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer',
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Drop a CSV file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">CSV files only (.csv)</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }} />
            </div>
          )}

          {step === 'preview' && parsed && schema && (
            <div className="space-y-4">
              {/* Column mapping summary */}
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  {matchedCols.length} matched columns
                </Badge>
                {unmatchedCsvCols.length > 0 && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                    {unmatchedCsvCols.length} CSV columns ignored ({unmatchedCsvCols.join(', ')})
                  </Badge>
                )}
                {unmatchedSchemaFields.length > 0 && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                    {unmatchedSchemaFields.length} fields use defaults ({unmatchedSchemaFields.map(f => f.name).join(', ')})
                  </Badge>
                )}
                {parsed.errors.length > 0 && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                    {parsed.errors.length} parse errors
                  </Badge>
                )}
              </div>

              {parsed.errors.length > 0 && (
                <div className="text-xs text-red-500 space-y-0.5">
                  {parsed.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}

              {/* Preview table — first 10 rows */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-xs w-10">#</TableHead>
                        {schema.fields.map(f => (
                          <TableHead key={f.name} className="text-xs whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {f.name}
                              {parsed.headers.includes(f.name) ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <span className="text-muted-foreground">(default)</span>
                              )}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappedRows.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          {schema.fields.map(f => (
                            <TableCell key={f.name} className="text-xs font-mono whitespace-nowrap">
                              {String(row[f.name] ?? '')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {mappedRows.length > 10 && (
                  <div className="text-xs text-muted-foreground text-center py-2 border-t bg-muted/20">
                    ... and {mappedRows.length - 10} more rows
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-8">
              {importing ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">Importing {mappedRows.length} rows...</p>
                </>
              ) : importResult ? (
                <>
                  {importResult.success > 0 ? (
                    <Check className="h-8 w-8 text-green-500 mb-3" />
                  ) : (
                    <X className="h-8 w-8 text-red-500 mb-3" />
                  )}
                  <p className="text-sm font-medium">
                    {importResult.success > 0
                      ? `Successfully imported ${importResult.success} rows`
                      : 'Import failed'}
                  </p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-3 text-xs text-red-500 space-y-0.5">
                      {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 border-t shrink-0">
          {step === 'select' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button onClick={handleImport} disabled={mappedRows.length === 0}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Import {mappedRows.length} rows
              </Button>
            </>
          )}
          {step === 'importing' && !importing && (
            <Button onClick={() => { reset(); onOpenChange(false) }}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
