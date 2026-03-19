import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { useProjectStore } from '@/stores/project-store'
import { toast } from 'sonner'
import { PageTransition } from '@/components/motion'

export const Route = createFileRoute('/projects/$projectId/settings')({
  component: ProjectSettingsPage,
})

function ProjectSettingsPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/settings' })
  const project = useProjectStore((s) => s.getProject(projectId))
  const updateProject = useProjectStore((s) => s.updateProject)
  const deleteProject = useProjectStore((s) => s.deleteProject)
  const navigate = useNavigate()

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!project) return null

  const handleDelete = () => {
    deleteProject(project.id)
    toast.success(`Project "${project.name}" deleted`)
    navigate({ to: '/' })
  }

  const canDelete = deleteConfirm === project.slug

  return (
    <PageTransition className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Project Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage settings for {project.name}.
        </p>
      </div>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">General</CardTitle>
          <CardDescription>Basic project information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={project.name}
              onChange={(e) => updateProject(project.id, { name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-desc">Description</Label>
            <Textarea
              id="project-desc"
              value={project.description}
              onChange={(e) =>
                updateProject(project.id, { description: e.target.value })
              }
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label>Project ID</Label>
            <Input value={project.id} readOnly className="font-mono text-sm text-muted-foreground" />
          </div>
          <div className="grid gap-2">
            <Label>Slug</Label>
            <Input value={project.slug} readOnly className="font-mono text-sm text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions. Please proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete this project</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                All schemas, entries, and versions will be permanently removed.
              </p>
            </div>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                  <DialogTitle>Delete Project</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete{' '}
                    <span className="font-semibold text-foreground">
                      {project.name}
                    </span>{' '}
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
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteOpen(false)
                      setDeleteConfirm('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!canDelete}
                    onClick={handleDelete}
                  >
                    Delete Permanently
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </PageTransition>
  )
}
