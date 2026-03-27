import { createFileRoute, useParams } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import {
  Tag,
  Clock,
  Eye,
  ArrowUpRight,
  RotateCcw,
  Trash2,
  Copy,
  GitCompareArrows,
  AlertTriangle,
  Search,
  Rocket,
  CheckCircle2,
  XCircle,
  Terminal,
  Globe,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePermissions } from '@/hooks/use-permissions'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Version } from '@/types/project'
import { Label } from '@/components/ui/label'
import {
  useVersions,
  usePublishVersion,
  usePromoteVersion,
  useRollbackVersion,
  useDeleteVersion,
  useCompareVersions,
} from '@/hooks/use-versions'
import {
  PageTransition,
  motion,
  staggerContainer,
  staggerItem,
} from '@/components/motion'
import { formatDistanceToNow } from 'date-fns'

export const Route = createFileRoute('/projects/$projectId/versions')({
  component: VersionsPage,
})

/* ═══════════════════════════════════════════════
   Color maps
   ═══════════════════════════════════════════════ */

const envColors: Record<string, string> = {
  development: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  staging: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  production: 'bg-green-500/10 text-green-600 border-green-500/20',
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 border-green-500/20',
  superseded: 'bg-muted text-muted-foreground border-border',
  rolled_back: 'bg-destructive/10 text-destructive border-destructive/20',
}

const ENV_LIST: Version['environment'][] = [
  'development',
  'staging',
  'production',
]

const EnvIcon = ({ env, className }: { env: string, className?: string }) => {
  if (env === 'development') return <Terminal className={className} />
  if (env === 'staging') return <Rocket className={className} />
  if (env === 'production') return <Globe className={className} />
  return <Tag className={className} />
}

/* ═══════════════════════════════════════════════
   Version Detail Dialog
   ═══════════════════════════════════════════════ */

function VersionDetailDialog({
  version,
  open,
  onOpenChange,
}: {
  version: Version
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const tableNames = Object.keys(version.data)
  const [activeTab, setActiveTab] = useState(tableNames[0] ?? '')
  const [search, setSearch] = useState('')

  const rows = version.data[activeTab] ?? []
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []
  const filtered = search
    ? rows.filter((row) =>
      columns.some((col) =>
        String(row[col] ?? '')
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    )
    : rows

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(version.data, null, 2))
    toast.success(t('versions.copiedJson'))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[1024px] sm:w-[1024px] h-[85vh] sm:h-[650px] flex flex-col p-0 overflow-hidden gap-0">

        {/* Full-width Main Header */}
        <DialogHeader className="px-6 py-5 border-b shrink-0 bg-background text-left">
          <div className="flex items-center gap-2">
            <DialogTitle className="font-mono">
              {version.versionTag}
            </DialogTitle>
            <Badge className={cn('text-xs', envColors[version.environment])}>
              {version.environment}
            </Badge>
            <Badge className={cn('text-xs', statusColors[version.status])}>
              {version.status}
            </Badge>
          </div>
          <DialogDescription className="mt-1">
            Published{' '}
            {new Date(version.publishedAt).toLocaleString()} —{' '}
            {version.tableCount} tables, {version.rowCount} rows
          </DialogDescription>
        </DialogHeader>

        {/* Split Content Area */}
        <div className="flex-1 flex flex-row overflow-hidden bg-background">

          {/* Sidebar */}
          {tableNames.length > 0 && (
            <div className="w-60 lg:w-64 border-r flex flex-col bg-muted/10 shrink-0 h-full">
              {/* Aligned with right pane header */}
              <div className="px-4 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0 bg-muted/20 h-[57px] flex items-center">
                Tables ({tableNames.length})
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {tableNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setActiveTab(name)
                      setSearch('')
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between group",
                      activeTab === name
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="truncate pr-2">{name}</span>
                    <Badge
                      variant={activeTab === name ? "secondary" : "outline"}
                      className={cn(
                        "ml-2 text-[10px] px-1.5 py-0 min-w-[20px] justify-center flex-shrink-0",
                        activeTab === name ? "" : "group-hover:bg-background"
                      )}
                    >
                      {version.data[name].length}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Right Pane */}
          <div className="flex-1 flex flex-col overflow-hidden bg-background h-full">
            {tableNames.length === 0 ? (
              <div className="flex-1 flex items-center justify-center bg-muted/5">
                <p className="text-sm text-muted-foreground text-center py-8">
                  No data in this version.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 border-b flex justify-between items-center gap-4 shrink-0 bg-muted/5 h-[57px]">
                  <h3 className="font-medium text-sm truncate">
                    {activeTab}
                  </h3>
                  <div className="relative w-full max-w-[240px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search rows…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 pl-8 text-xs w-full bg-background"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4 sm:p-6 bg-muted/5">
                  <div className="border rounded-lg overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            {columns.map((col) => (
                              <TableHead
                                key={col}
                                className="text-xs whitespace-nowrap h-9"
                              >
                                {col}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((row, i) => (
                            <TableRow key={i} className="hover:bg-muted/20">
                              {columns.map((col) => (
                                <TableCell
                                  key={col}
                                  className="font-mono text-xs whitespace-nowrap py-2"
                                >
                                  {String(row[col] ?? '')}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                          {filtered.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={columns.length}
                                className="text-center text-sm text-muted-foreground py-12"
                              >
                                {search ? 'No matching rows found in this table.' : 'No data in this table.'}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="px-6 pb-4 pt-4 border-t shrink-0 flex justify-end bg-background">
              <Button variant="outline" size="sm" onClick={handleCopyJson}>
                <Copy className="h-3.5 w-3.5 mr-2" />
                {t('versions.copyJson')}
              </Button>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════
   Promote Dialog
   ═══════════════════════════════════════════════ */

function PromoteDialog({
  version,
  allVersions,
  open,
  onOpenChange,
}: {
  version: Version
  allVersions: Version[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const promoteVersionMut = usePromoteVersion()
  const targets = ENV_LIST.filter((e) => e !== version.environment)
  const [targetEnv, setTargetEnv] = useState<Version['environment']>(
    targets[0],
  )

  const _activeInTarget_unused = allVersions.find(
    (v) => v.environment === targetEnv && v.status === 'active',
  )
  void _activeInTarget_unused

  const handlePromote = async () => {
    try {
      const v = await promoteVersionMut.mutateAsync({ versionId: version.id, targetEnv })
      toast.success(t('versions.promoted', { env: targetEnv, tag: v.versionTag }))
      onOpenChange(false)
    } catch {
      toast.error(t('versions.promoteFailed'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[480px] sm:w-[480px] h-[450px] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{t('versions.promoteVersion', { tag: version.versionTag })}</DialogTitle>
          <DialogDescription>
            {t('versions.promoteDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4 space-y-3 flex-1 overflow-y-auto">
          <div className="space-y-2">
            {targets.map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => setTargetEnv(env)}
                className={cn(
                  'flex items-center gap-3 p-3 border rounded-lg text-left w-full transition-colors',
                  targetEnv === env
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50',
                  env === 'production' &&
                  targetEnv === env &&
                  'border-destructive bg-destructive/5',
                )}
              >
                <div
                  className={cn(
                    'h-4 w-4 rounded-full border-2 shrink-0 transition-colors',
                    targetEnv === env
                      ? env === 'production'
                        ? 'border-destructive bg-destructive'
                        : 'border-primary bg-primary'
                      : 'border-muted-foreground/30',
                  )}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize">{env}</p>
                  {allVersions.find(
                    (v) => v.environment === env && v.status === 'active',
                  ) && (
                      <p className="text-xs text-muted-foreground">
                        Currently:{' '}
                        {
                          allVersions.find(
                            (v) => v.environment === env && v.status === 'active',
                          )?.versionTag
                        }{' '}
                        (will be superseded)
                      </p>
                    )}
                </div>
              </button>
            ))}
          </div>
          {targetEnv === 'production' && (
            <div className="flex gap-2 items-start bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                {t('versions.productionWarning')}
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="px-6 pb-6 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={targetEnv === 'production' ? 'destructive' : 'default'}
            onClick={handlePromote}
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            {t('versions.promoteTo', { env: targetEnv })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════
   Rollback Dialog
   ═══════════════════════════════════════════════ */

function RollbackDialog({
  version,
  currentActive,
  open,
  onOpenChange,
}: {
  version: Version
  currentActive: Version | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const rollbackVersionMut = useRollbackVersion()

  const handleRollback = async () => {
    try {
      await rollbackVersionMut.mutateAsync(version.id)
      toast.success(t('versions.rolledBack', { tag: version.versionTag }))
      onOpenChange(false)
    } catch {
      toast.error(t('versions.rollbackFailed'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[480px] sm:w-[480px] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{t('versions.rollbackTo', { tag: version.versionTag })}</DialogTitle>
          <DialogDescription>
            <Trans i18nKey="versions.rollbackDescription" values={{ tag: version.versionTag, env: version.environment }} components={{ strong: <strong className="font-semibold text-foreground" /> }} />
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4 space-y-3 text-sm">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <RotateCcw className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p>
                <span className="font-mono font-medium">
                  {version.versionTag}
                </span>{' '}
                → will become{' '}
                <Badge
                  className={cn('text-[10px]', statusColors.active)}
                >
                  active
                </Badge>
              </p>
              {currentActive && (
                <p className="text-muted-foreground mt-1">
                  <span className="font-mono">
                    {currentActive.versionTag}
                  </span>{' '}
                  → will become{' '}
                  <Badge
                    className={cn('text-[10px]', statusColors.rolled_back)}
                  >
                    rolled_back
                  </Badge>
                </p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="px-6 pb-6 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleRollback}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('versions.rollback')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════
   Delete Dialog
   ═══════════════════════════════════════════════ */

function DeleteVersionDialog({
  version,
  open,
  onOpenChange,
}: {
  version: Version
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const deleteVersionMut = useDeleteVersion()

  const handleDelete = async () => {
    try {
      await deleteVersionMut.mutateAsync(version.id)
      toast.success(t('versions.deleted', { tag: version.versionTag }))
      onOpenChange(false)
    } catch {
      toast.error(t('versions.deleteFailed'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[480px] sm:w-[480px] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{t('versions.deleteVersion')}</DialogTitle>
          <DialogDescription>
            <Trans i18nKey="versions.deleteDescription" values={{ tag: version.versionTag, env: version.environment }} components={{ strong: <strong className="font-semibold text-foreground" /> }} />
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="px-6 pb-6 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════
   Compare Dialog
   ═══════════════════════════════════════════════ */

const diffRowColors = {
  added: 'bg-green-500/5 border-l-2 border-l-green-500',
  removed: 'bg-red-500/5 border-l-2 border-l-red-500 opacity-70',
  modified: 'bg-amber-500/5 border-l-2 border-l-amber-500',
}

const diffStatusColors: Record<string, string> = {
  added: 'bg-green-500/10 text-green-600 border-green-500/20',
  removed: 'bg-red-500/10 text-red-600 border-red-500/20',
  modified: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  unchanged: 'bg-muted text-muted-foreground border-border',
}

function CompareDialog({
  allVersions,
  preselectedId,
  open,
  onOpenChange,
}: {
  allVersions: Version[]
  preselectedId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [v1Id, setV1Id] = useState(preselectedId ?? '')
  const [v2Id, setV2Id] = useState('')
  const { data: diff = null, isLoading: isComparing } = useCompareVersions(v1Id, v2Id)

  const v1 = allVersions.find((v) => v.id === v1Id)
  const v2 = allVersions.find((v) => v.id === v2Id)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) { setV1Id(preselectedId ?? ''); setV2Id('') }
        onOpenChange(o)
      }}
    >
      <DialogContent className="w-[95vw] sm:max-w-[900px] sm:w-[900px] h-[85vh] sm:h-[700px] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>{t('versions.compareVersions')}</DialogTitle>
          <DialogDescription>
            {t('versions.compareDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4 flex items-end gap-3 shrink-0">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">{t('versions.base')}</label>
            <Select value={v1Id} onValueChange={setV1Id}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={t('versions.selectVersion')} />
              </SelectTrigger>
              <SelectContent>
                {allVersions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="font-mono">{v.versionTag}</span>
                    <Badge
                      className={cn(
                        'text-[10px] ml-2',
                        envColors[v.environment],
                      )}
                    >
                      {v.environment}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-muted-foreground text-sm pb-2">vs</span>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">{t('versions.compareTo')}</label>
            <Select value={v2Id} onValueChange={setV2Id}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={t('versions.selectVersion')} />
              </SelectTrigger>
              <SelectContent>
                {allVersions
                  .filter((v) => v.id !== v1Id)
                  .map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <span className="font-mono">{v.versionTag}</span>
                      <Badge
                        className={cn(
                          'text-[10px] ml-2',
                          envColors[v.environment],
                        )}
                      >
                        {v.environment}
                      </Badge>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            disabled={!v1Id || !v2Id || isComparing}
            className="mb-0"
          >
            {isComparing ? t('versions.comparing') : t('versions.compare')}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {diff ? (
            <>
              {/* Summary */}
              <div className="flex flex-wrap gap-3 text-xs">
                {diff.summary.tablesAdded > 0 && (
                  <Badge className={diffStatusColors.added}>
                    +{diff.summary.tablesAdded} tables
                  </Badge>
                )}
                {diff.summary.tablesRemoved > 0 && (
                  <Badge className={diffStatusColors.removed}>
                    -{diff.summary.tablesRemoved} tables
                  </Badge>
                )}
                {diff.summary.tablesModified > 0 && (
                  <Badge className={diffStatusColors.modified}>
                    ~{diff.summary.tablesModified} tables modified
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {diff.summary.totalRowsAdded > 0 &&
                    `+${diff.summary.totalRowsAdded} rows `}
                  {diff.summary.totalRowsRemoved > 0 &&
                    `-${diff.summary.totalRowsRemoved} rows `}
                  {diff.summary.totalRowsModified > 0 &&
                    `~${diff.summary.totalRowsModified} changed`}
                </span>
              </div>

              {/* Per-table diffs */}
              {diff.tableDiffs
                .filter((t) => t.status !== 'unchanged')
                .map((td) => {
                  const allCols = new Set<string>()
                    ;[...td.addedRows, ...td.removedRows].forEach((r) =>
                      Object.keys(r).forEach((k) => allCols.add(k)),
                    )
                  td.modifiedRows.forEach((m) => {
                    Object.keys(m.before).forEach((k) => allCols.add(k))
                    Object.keys(m.after).forEach((k) => allCols.add(k))
                  })
                  const cols = Array.from(allCols)

                  return (
                    <div key={td.tableName} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">
                          {td.tableName}
                        </h4>
                        <Badge
                          className={cn(
                            'text-[10px]',
                            diffStatusColors[td.status],
                          )}
                        >
                          {td.status}
                        </Badge>
                      </div>
                      {cols.length > 0 && (
                        <div className="border rounded-lg overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableHead className="w-8 text-xs">
                                  +/-
                                </TableHead>
                                {cols.map((c) => (
                                  <TableHead
                                    key={c}
                                    className="text-xs whitespace-nowrap"
                                  >
                                    {c}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {td.addedRows.map((row, i) => (
                                <TableRow
                                  key={`a-${i}`}
                                  className={diffRowColors.added}
                                >
                                  <TableCell className="text-xs text-green-600 font-bold">
                                    +
                                  </TableCell>
                                  {cols.map((c) => (
                                    <TableCell
                                      key={c}
                                      className="font-mono text-xs whitespace-nowrap"
                                    >
                                      {String(row[c] ?? '')}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                              {td.removedRows.map((row, i) => (
                                <TableRow
                                  key={`r-${i}`}
                                  className={diffRowColors.removed}
                                >
                                  <TableCell className="text-xs text-red-600 font-bold">
                                    -
                                  </TableCell>
                                  {cols.map((c) => (
                                    <TableCell
                                      key={c}
                                      className="font-mono text-xs whitespace-nowrap line-through"
                                    >
                                      {String(row[c] ?? '')}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                              {td.modifiedRows.map((mod, i) => (
                                <TableRow
                                  key={`m-${i}`}
                                  className={diffRowColors.modified}
                                >
                                  <TableCell className="text-xs text-amber-600 font-bold">
                                    ~
                                  </TableCell>
                                  {cols.map((c) => (
                                    <TableCell
                                      key={c}
                                      className={cn(
                                        'font-mono text-xs whitespace-nowrap',
                                        mod.changedFields.includes(c) &&
                                        'font-bold',
                                      )}
                                    >
                                      {mod.changedFields.includes(c) ? (
                                        <>
                                          <span className="text-red-500 line-through mr-1">
                                            {String(mod.before[c] ?? '')}
                                          </span>
                                          <span className="text-green-600">
                                            {String(mod.after[c] ?? '')}
                                          </span>
                                        </>
                                      ) : (
                                        String(mod.after[c] ?? '')
                                      )}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )
                })}

              {diff.tableDiffs.every((td) => td.status === 'unchanged') && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t('versions.noDifferences', { v1: v1?.versionTag, v2: v2?.versionTag })}
                </p>
              )}
            </>
          ) : isComparing ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
              <p className="text-sm text-muted-foreground">{t('versions.comparing')}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('versions.selectVersions')}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════ */

function VersionsPage() {
  const { t } = useTranslation()
  const { projectId } = useParams({ from: '/projects/$projectId/versions' })
  const { data: versions = [] } = useVersions(projectId)

  // Filters
  const [filterEnv, setFilterEnv] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const filtered = useMemo(
    () =>
      versions.filter((v) => {
        if (filterEnv !== 'all' && v.environment !== filterEnv) return false
        if (filterStatus !== 'all' && v.status !== filterStatus) return false
        return true
      }),
    [versions, filterEnv, filterStatus],
  )

  const { canPublish, canEdit } = usePermissions()

  // Dialog state
  const [publishOpen, setPublishOpen] = useState(false)
  const [viewVersion, setViewVersion] = useState<Version | null>(null)
  const [promoteVersion, setPromoteVersion] = useState<Version | null>(null)
  const [rollbackVersion, setRollbackVersion] = useState<Version | null>(null)
  const [deleteVersion, setDeleteVersion] = useState<Version | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)

  const publishVersionMut = usePublishVersion()
  const handlePublish = async (env: 'development' | 'staging' | 'production') => {
    try {
      const version = await publishVersionMut.mutateAsync({ projectId, environment: env })
      toast.success(t('versions.published', { tag: version.versionTag, env }))
    } catch (err) {
      toast.error(t('versions.publishFailed', { error: err instanceof Error ? err.message : 'Unknown error' }))
    }
  }

  // Active version per env
  const activePerEnv = useMemo(() => {
    const map: Record<string, Version | undefined> = {}
    for (const env of ENV_LIST) {
      map[env] = versions.find(
        (v) => v.environment === env && v.status === 'active',
      )
    }
    return map
  }, [versions])

  if (versions.length === 0) {
    return (
      <PageTransition className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('versions.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('versions.description')}
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4"
            >
              <Tag className="h-8 w-8 text-primary" />
            </motion.div>
            <h3 className="text-lg font-semibold mb-2">
              {t('versions.noVersions')}
            </h3>
            <p className="text-muted-foreground text-sm text-center max-w-md">
              {t('versions.noVersionsDescription')}
            </p>
            {canPublish && (
              <Button className="mt-6" onClick={() => setPublishOpen(true)}>
                <Rocket className="h-3.5 w-3.5 mr-1.5" />
                {t('versions.publish')}
              </Button>
            )}
            <div className="flex gap-6 mt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {t('versions.immutableSnapshots')}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {t('versions.versionHistory')}
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-primary" />
                {t('versions.oneClickRollback')}
              </div>
            </div>
          </CardContent>
        </Card>
        <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} onPublish={handlePublish} />
      </PageTransition>
    )
  }

  return (
    <PageTransition className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('versions.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('versions.description')}
          </p>
        </div>
        {canPublish && <Button size="sm" onClick={() => setPublishOpen(true)}>
          <Rocket className="h-3.5 w-3.5 mr-1.5" />
          {t('versions.publish')}
        </Button>}
      </div>

      {/* Environment overview cards */}
      <motion.div
        className="grid gap-4 md:grid-cols-3"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {ENV_LIST.map((env) => {
          const active = activePerEnv[env]
          return (
            <motion.div key={env} variants={staggerItem}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge className={cn('text-xs', envColors[env])}>
                      {env}
                    </Badge>
                    {active && (
                      <Badge className={cn('text-xs', statusColors.active)}>
                        active
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {active ? (
                    <>
                      <p className="text-2xl font-bold font-mono">
                        {active.versionTag}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {active.tableCount} tables · {active.rowCount} rows ·{' '}
                        {formatDistanceToNow(new Date(active.publishedAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('environments.noActiveVersion')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Select value={filterEnv} onValueChange={setFilterEnv}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('environments.allEnvironments')}</SelectItem>
            {ENV_LIST.map((e) => (
              <SelectItem key={e} value={e} className="capitalize">
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('status.allStatuses')}</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="superseded">Superseded</SelectItem>
            <SelectItem value="rolled_back">Rolled back</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCompareOpen(true)}
        >
          <GitCompareArrows className="h-4 w-4 mr-2" />
          {t('versions.compare')}
        </Button>
      </div>

      {/* Version list */}
      <TooltipProvider>
        <motion.div
          className="space-y-2"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {filtered.map((version) => {
            void versions.find(
              (v) =>
                v.environment === version.environment &&
                v.status === 'active' &&
                v.id !== version.id,
            )

            return (
              <motion.div key={version.id} variants={staggerItem}>
                <Card className="group p-3 sm:p-4 overflow-hidden transition-all duration-200 hover:border-primary/20 hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_2px_10px_rgba(255,255,255,0.04)]">
                  <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-0">
                    {/* Left: Icon & Info */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div
                        className={cn(
                          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors',
                          envColors[version.environment] || 'bg-muted/50 border-border text-muted-foreground'
                        )}
                      >
                        <EnvIcon env={version.environment} className="h-6 w-6" />
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <code className="text-base font-bold tracking-tight truncate">
                            {version.versionTag}
                          </code>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-xs h-6 px-2.5 border-0 font-medium',
                              statusColors[version.status],
                            )}
                          >
                            {version.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[13px] text-muted-foreground font-medium">
                          <span>{version.tableCount} tables</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                          <span>{version.rowCount} rows</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Date & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-[54px] sm:pl-0 mt-2 sm:mt-0">
                      <div className="flex w-[165px] shrink-0 items-center justify-start gap-1.5 text-[13px] text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity mr-1">
                        <Clock className="h-4 w-4 shrink-0" />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="whitespace-nowrap cursor-default">
                              {formatDistanceToNow(
                                new Date(version.publishedAt),
                                { addSuffix: true },
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {new Date(version.publishedAt).toLocaleString()}
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2 w-[168px] shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-foreground"
                              onClick={() => setViewVersion(version)}
                            >
                              <Eye className="h-[18px] w-[18px]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('versions.viewData')}</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  JSON.stringify(version.data, null, 2),
                                )
                                toast.success(t('versions.copiedJson'))
                              }}
                            >
                              <Copy className="h-[18px] w-[18px]" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('versions.copyJson')}</TooltipContent>
                        </Tooltip>

                        {version.r2Url && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                asChild
                              >
                                <a href={version.r2Url} target="_blank" rel="noopener noreferrer">
                                  <Globe className="h-[18px] w-[18px]" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('versions.viewOnCdn')}</TooltipContent>
                          </Tooltip>
                        )}

                        {version.status === 'active' && canPublish && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                onClick={() => setPromoteVersion(version)}
                              >
                                <ArrowUpRight className="h-[18px] w-[18px]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('versions.promoteToTarget')}</TooltipContent>
                          </Tooltip>
                        )}

                        {version.status !== 'active' && canPublish && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                                onClick={() => setRollbackVersion(version)}
                              >
                                <RotateCcw className="h-[18px] w-[18px]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('versions.rollbackToThis')}</TooltipContent>
                          </Tooltip>
                        )}

                        {version.status !== 'active' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                                onClick={() => setDeleteVersion(version)}
                              >
                                <Trash2 className="h-[18px] w-[18px]" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('common.delete')}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}

          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No versions match the current filters.
            </p>
          )}
        </motion.div>
      </TooltipProvider>

      {/* Dialogs */}
      {viewVersion && (
        <VersionDetailDialog
          version={viewVersion}
          open={!!viewVersion}
          onOpenChange={(o) => !o && setViewVersion(null)}
        />
      )}
      {promoteVersion && (
        <PromoteDialog
          version={promoteVersion}
          allVersions={versions}
          open={!!promoteVersion}
          onOpenChange={(o) => !o && setPromoteVersion(null)}
        />
      )}
      {rollbackVersion && (
        <RollbackDialog
          version={rollbackVersion}
          currentActive={versions.find(
            (v) =>
              v.environment === rollbackVersion.environment &&
              v.status === 'active',
          )}
          open={!!rollbackVersion}
          onOpenChange={(o) => !o && setRollbackVersion(null)}
        />
      )}
      {deleteVersion && (
        <DeleteVersionDialog
          version={deleteVersion}
          open={!!deleteVersion}
          onOpenChange={(o) => !o && setDeleteVersion(null)}
        />
      )}
      <CompareDialog
        allVersions={versions}
        open={compareOpen}
        onOpenChange={setCompareOpen}
      />
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onPublish={handlePublish}
      />
    </PageTransition>
  )
}

/* ═══════════════════════════════════════════════
   Publish Dialog
   ═══════════════════════════════════════════════ */

const ENV_OPTIONS = [
  { value: 'development' as const, label: 'Development', desc: 'For testing and development builds' },
  { value: 'staging' as const, label: 'Staging', desc: 'Pre-production environment for QA' },
  { value: 'production' as const, label: 'Production', desc: 'Live environment for all players' },
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
  const { t } = useTranslation()
  const [env, setEnv] = useState<'development' | 'staging' | 'production'>('staging')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{t('versions.publishVersion')}</DialogTitle>
          <DialogDescription>
            {t('versions.publishDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 py-4">
          <Label>{t('versions.targetEnvironment')}</Label>
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
                  opt.value === 'production' && env === opt.value && 'border-destructive bg-destructive/5',
                )}
              >
                <div className={cn(
                  'h-4 w-4 rounded-full border-2 shrink-0 transition-colors',
                  env === opt.value
                    ? opt.value === 'production' ? 'border-destructive bg-destructive' : 'border-primary bg-primary'
                    : 'border-muted-foreground/30',
                )} />
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
              <p>{t('versions.publishProductionWarning')}</p>
            </div>
          )}
        </div>
        <DialogFooter className="px-6 pb-6 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button
            variant={env === 'production' ? 'destructive' : 'default'}
            onClick={() => { onPublish(env); onOpenChange(false) }}
          >
            <Rocket className="h-4 w-4 mr-2" />
            {t('versions.publishTo', { env })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
