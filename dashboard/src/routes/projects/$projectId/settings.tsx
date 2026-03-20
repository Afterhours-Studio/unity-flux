import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router'
import { useState, useRef } from 'react'
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
import { toast } from 'sonner'
import { PageTransition } from '@/components/motion'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/projects/$projectId/settings')({
  component: ProjectSettingsPage,
})

function ProjectSettingsPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/settings' })
  const { data: project, isLoading } = useProject(projectId)
  const updateProjectMut = useUpdateProject()
  const deleteProjectMut = useDeleteProject()
  const navigate = useNavigate()

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const iconInputRef = useRef<HTMLInputElement>(null)

  const isEmojiIcon = project ? !project.icon.startsWith('http') && !project.icon.startsWith('/') : false

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!project) return null

  const handleDelete = async () => {
    try {
      await deleteProjectMut.mutateAsync(project.id)
      toast.success(`Project "${project.name}" deleted`)
      navigate({ to: '/' })
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const canDelete = deleteConfirm === project.slug

  return (
    <PageTransition className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage settings for {project.name}.
        </p>
      </div>

      {/* Project Icon — Telegram style */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="cursor-pointer hover:opacity-80 transition-opacity">
            <ProjectIcon icon={project.icon || ''} name={project.name} size="lg" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => iconInputRef.current?.click()}>
            <Camera className="h-4 w-4 mr-2" />
            Set Project Photo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEmojiPickerOpen(true)}>
            <Smile className="h-4 w-4 mr-2" />
            Use an Emoji
          </DropdownMenuItem>
          {project.icon && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                updateProjectMut.mutate({ id: project.id, updates: { icon: '' } })
                toast.success('Icon removed')
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Remove
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={iconInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            updateProjectMut.mutate({ id: project.id, updates: { icon: reader.result as string } })
            toast.success('Icon updated')
          }
          reader.readAsDataURL(file)
          e.target.value = ''
        }}
      />

      {/* Emoji picker dialog */}
      <Dialog open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
        <DialogContent className="sm:max-w-xs p-0" showCloseButton={false}>
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-sm">Choose an Emoji</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-1 px-4 pb-4 max-h-[240px] overflow-y-auto">
            {['🎮', '⚔️', '🏰', '🚀', '🎯', '🔥', '💎', '🌟', '🎲', '🎪', '🐉', '🦊', '🐺', '🦁', '🦅', '🌍', '🌙', '☀️', '⚡', '💀', '👾', '🤖', '🧙', '🧝', '🏹', '🗡️', '🛡️', '💰', '🏆', '🎖️', '📦', '🔮', '🧪', '⚗️', '🔧', '⚙️', '🎵', '🎸', '🏎️', '✈️', '🚢', '🏠', '🏗️', '🌲', '🌸', '❄️', '🔶', '🟢', '🔵', '🟣'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  updateProjectMut.mutate({ id: project.id, updates: { icon: emoji } })
                  setEmojiPickerOpen(false)
                  toast.success('Icon updated')
                }}
                className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-accent text-xl transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Form fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label className="text-xs">Project Name</Label>
          <Input
            value={project.name}
            onChange={(e) => updateProjectMut.mutate({ id: project.id, updates: { name: e.target.value } })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Slug</Label>
          <Input value={project.slug} readOnly className="font-mono text-sm text-muted-foreground" />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={project.description}
          onChange={(e) => updateProjectMut.mutate({ id: project.id, updates: { description: e.target.value } })}
          rows={2}
        />
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Project ID</Label>
        <Input value={project.id} readOnly className="font-mono text-sm text-muted-foreground" />
      </div>

      <Separator />

      {/* Danger Zone */}
      <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4">
        <div>
          <p className="text-sm font-medium">Delete this project</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            All data, versions, and formulas will be permanently removed.
          </p>
        </div>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle>Delete Project</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete{' '}
                <span className="font-semibold text-foreground">{project.name}</span>{' '}
                and all associated data.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 px-6 py-4">
              <Label htmlFor="delete-confirm">
                Type <span className="font-mono font-semibold text-foreground">{project.slug}</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                placeholder={project.slug}
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                autoComplete="off"
              />
            </div>
            <DialogFooter className="px-6 pb-6 pt-2">
              <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteConfirm('') }}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={!canDelete} onClick={handleDelete}>
                Delete Permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  )
}
