import { createFileRoute, useParams } from '@tanstack/react-router'
import { Clock, Tag, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useProjectStore } from '@/stores/project-store'

export const Route = createFileRoute('/projects/$projectId/versions')({
  component: VersionsPage,
})

function VersionsPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/versions' })
  const project = useProjectStore((s) => s.getProject(projectId))

  if (!project) return null

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Version Manager</h1>
        <p className="text-muted-foreground mt-1">
          Publish, compare, and rollback configuration versions.
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Tag className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No versions published</h3>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            Once you have schemas and entries configured, you can publish versioned
            snapshots that will be delivered to your Unity game clients via Cloudflare R2.
          </p>
          <div className="flex gap-6 mt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Immutable snapshots
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Version history
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-primary" />
              One-click rollback
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
