import { createFileRoute, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { Copy, Eye, EyeOff, RefreshCw, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProjectStore } from '@/stores/project-store'
import { toast } from 'sonner'

export const Route = createFileRoute('/projects/$projectId/')({
  component: ProjectOverview,
})

function CopyableField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [visible, setVisible] = useState(!secret)

  const copy = () => {
    navigator.clipboard.writeText(value)
    toast.success(`${label} copied to clipboard`)
  }

  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input
          readOnly
          value={visible ? value : '•'.repeat(Math.min(value.length, 40))}
          className="font-mono text-sm"
        />
        {secret && (
          <Button variant="outline" size="icon" onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
        <Button variant="outline" size="icon" onClick={copy}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function ProjectOverview() {
  const { projectId } = useParams({ from: '/projects/$projectId/' })
  const project = useProjectStore((s) => s.getProject(projectId))
  const updateProject = useProjectStore((s) => s.updateProject)
  const regenerateApiKey = useProjectStore((s) => s.regenerateApiKey)
  const schemas = useProjectStore(
    useShallow((s) => s.schemas.filter((sc) => sc.projectId === projectId)),
  )

  if (!project) return null

  const handleRegenerate = () => {
    regenerateApiKey(project.id)
    toast.success('API key regenerated')
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        <p className="text-muted-foreground mt-1">{project.description || 'No description'}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Schemas</CardDescription>
            <CardTitle className="text-2xl">{schemas.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Environment</CardDescription>
            <CardTitle className="text-2xl capitalize">{project.environment}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
            <CardTitle className="text-2xl">
              <Badge variant="outline" className="text-sm">Active</Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Separator />

      {/* Unity SDK Integration Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Unity SDK Integration</CardTitle>
          </div>
          <CardDescription>
            Use these credentials in your Unity project's FluxConfig to connect to this dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyableField label="Project ID" value={project.id} />
          <CopyableField label="Project Slug" value={project.slug} />

          <Separator />

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">API Key</Label>
            <div className="flex gap-2">
              <Input readOnly value={'•'.repeat(20)} className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => {
                navigator.clipboard.writeText(project.apiKey)
                toast.success('API Key copied')
              }}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleRegenerate}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Used for server-side operations. Keep this secret.</p>
          </div>

          <CopyableField label="Anonymous Key (Client-safe)" value={project.anonKey} secret />

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Supabase URL</Label>
              <Input
                placeholder="https://your-project.supabase.co"
                value={project.supabaseUrl}
                onChange={(e) => updateProject(project.id, { supabaseUrl: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">R2 Bucket URL</Label>
              <Input
                placeholder="https://flux-cdn.yourstudio.com"
                value={project.r2BucketUrl}
                onChange={(e) => updateProject(project.id, { r2BucketUrl: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Environment</Label>
            <Select
              value={project.environment}
              onValueChange={(value: 'development' | 'staging' | 'production') =>
                updateProject(project.id, { environment: value })
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Unity Code Snippet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Start — Unity</CardTitle>
          <CardDescription>
            Add this to your game's initialization script.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto">
{`FluxManager.Instance.Configure(new FluxConfig
{
    ProjectSlug = "${project.slug}",
    Environment = FluxEnvironment.${project.environment.charAt(0).toUpperCase() + project.environment.slice(1)},
    CdnBaseUrl = "${project.r2BucketUrl || 'https://flux-cdn.yourstudio.com'}",
    AnonKey = "${project.anonKey.substring(0, 10)}..."
});

await FluxManager.Instance.InitializeAsync();
await FluxManager.Instance.SyncAsync();`}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
