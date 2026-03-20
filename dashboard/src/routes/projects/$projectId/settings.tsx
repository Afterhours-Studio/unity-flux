import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router'
import { useState, useRef } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Trash2, Camera, Smile, X, Globe, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectIcon } from '@/components/project-icon'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useProject, useUpdateProject, useDeleteProject } from '@/hooks/use-projects'
import { usePermissions } from '@/hooks/use-permissions'
import { toast } from 'sonner'
import { PageTransition } from '@/components/motion'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/projects/$projectId/settings')({
  component: ProjectSettingsPage,
})

function ProjectSettingsPage() {
  const { t } = useTranslation()
  const { projectId } = useParams({ from: '/projects/$projectId/settings' })
  const { data: project, isLoading } = useProject(projectId)
  const updateProjectMut = useUpdateProject()
  const deleteProjectMut = useDeleteProject()
  const navigate = useNavigate()

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const iconInputRef = useRef<HTMLInputElement>(null)

  const { canManageProject } = usePermissions()
  const isEmojiIcon = project ? !project.icon.startsWith('http') && !project.icon.startsWith('/') : false

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!project) return null

  const handleDelete = async () => {
    try {
      await deleteProjectMut.mutateAsync(project.id)
      toast.success(t('projects.deleted', { name: project.name }))
      navigate({ to: '/' })
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const canDelete = deleteConfirm === project.slug

  return (
    <PageTransition className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('projects.settings')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('projects.manageSettings', { name: project.name })}
        </p>
      </div>

      {/* Hidden inputs + dialogs */}
      <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
          updateProjectMut.mutate({ id: project.id, updates: { icon: reader.result as string } })
          toast.success(t('projects.iconUpdated'))
        }
        reader.readAsDataURL(file)
        e.target.value = ''
      }} />
      <Dialog open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
        <DialogContent className="sm:max-w-xs p-0" showCloseButton={false}>
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-sm">{t('projects.chooseEmoji')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-1 px-4 pb-4 max-h-[240px] overflow-y-auto">
            {['🎮', '⚔️', '🏰', '🚀', '🎯', '🔥', '💎', '🌟', '🎲', '🎪', '🐉', '🦊', '🐺', '🦁', '🦅', '🌍', '🌙', '☀️', '⚡', '💀', '👾', '🤖', '🧙', '🧝', '🏹', '🗡️', '🛡️', '💰', '🏆', '🎖️', '📦', '🔮', '🧪', '⚗️', '🔧', '⚙️', '🎵', '🎸', '🏎️', '✈️', '🚢', '🏠', '🏗️', '🌲', '🌸', '❄️', '🔶', '🟢', '🔵', '🟣'].map((emoji) => (
              <button key={emoji} onClick={() => { updateProjectMut.mutate({ id: project.id, updates: { icon: emoji } }); setEmojiPickerOpen(false); toast.success(t('projects.iconUpdated')) }} className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-accent text-xl transition-colors">{emoji}</button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Two-column layout ── */}
      <div className="space-y-6">
        {/* Icon */}
        <div className="grid grid-cols-[180px_1fr] gap-6 items-start">
          <div className="pt-1">
            <p className="text-sm font-medium">{t('projects.projectIcon')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('projects.clickToChange')}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="cursor-pointer hover:opacity-80 transition-opacity">
                <ProjectIcon icon={project.icon || ''} name={project.name} size="lg" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => iconInputRef.current?.click()}>
                <Camera className="h-4 w-4 mr-2" />
                {t('projects.setProjectPhoto')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEmojiPickerOpen(true)}>
                <Smile className="h-4 w-4 mr-2" />
                {t('projects.useEmoji')}
              </DropdownMenuItem>
              {project.icon && (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { updateProjectMut.mutate({ id: project.id, updates: { icon: '' } }); toast.success(t('projects.iconRemoved')) }}>
                  <X className="h-4 w-4 mr-2" />
                  {t('common.remove')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator />

        {/* Name */}
        <div className="grid grid-cols-[180px_1fr] gap-6 items-center">
          <p className="text-sm font-medium">{t('projects.projectName')}</p>
          <Input value={project.name} onChange={(e) => updateProjectMut.mutate({ id: project.id, updates: { name: e.target.value } })} />
        </div>

        {/* Slug */}
        <div className="grid grid-cols-[180px_1fr] gap-6 items-center">
          <div>
            <p className="text-sm font-medium">{t('projects.slug')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('projects.autoGenerated')}</p>
          </div>
          <Input value={project.slug} readOnly className="font-mono text-sm text-muted-foreground bg-muted/30" />
        </div>

        {/* Description */}
        <div className="grid grid-cols-[180px_1fr] gap-6 items-start">
          <p className="text-sm font-medium pt-2">{t('projects.description')}</p>
          <Textarea value={project.description} onChange={(e) => updateProjectMut.mutate({ id: project.id, updates: { description: e.target.value } })} rows={2} />
        </div>

        {/* Project ID */}
        <div className="grid grid-cols-[180px_1fr] gap-6 items-center">
          <p className="text-sm font-medium">{t('projects.projectId')}</p>
          <div className="flex gap-2">
            <Input value={project.id} readOnly className="font-mono text-sm text-muted-foreground bg-muted/30" />
            <Button variant="outline" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText(project.id); toast.success(t('projects.copied')) }}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Danger Zone */}
        {canManageProject && <div className="grid grid-cols-[180px_1fr] gap-6 items-center">
          <p className="text-sm font-medium text-destructive">{t('dangerZone.title')}</p>
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4">
            <div>
              <p className="text-sm font-medium">{t('dangerZone.deleteProject')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('dangerZone.deleteProjectDescription')}</p>
            </div>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {t('common.delete')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                  <DialogTitle>{t('projects.deleteProject')}</DialogTitle>
                  <DialogDescription>
                    <Trans i18nKey="projects.deleteConfirmation" values={{ name: project.name }} components={{ strong: <strong className="font-semibold text-foreground" /> }} />
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2 px-6 py-4">
                  <Label htmlFor="delete-confirm">
                    Type <span className="font-mono font-semibold text-foreground">{project.slug}</span> to confirm
                  </Label>
                  <Input id="delete-confirm" placeholder={project.slug} value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} autoComplete="off" />
                </div>
                <DialogFooter className="px-6 pb-6 pt-2">
                  <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteConfirm('') }}>{t('common.cancel')}</Button>
                  <Button variant="destructive" disabled={!canDelete} onClick={handleDelete}>{t('projects.deletePermanently')}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>}
      </div>

      {/* Credit */}
      <div className="pt-8 pb-2">
        <p className="text-xs text-muted-foreground/40 text-center">
          Built by <a href="https://github.com/h1dr0n" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors">h1dr0n</a>
        </p>
      </div>
    </PageTransition>
  )
}
