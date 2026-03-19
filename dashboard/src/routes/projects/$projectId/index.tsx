import { createFileRoute, useParams, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useShallow } from 'zustand/shallow'
import {
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Rocket,
  ArrowUpRight,
  Clock,

  Trash2,
  Plus,
  Pencil,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores/project-store'
import type { Project } from '@/types/project'
import { toast } from 'sonner'
import { PageTransition } from '@/components/motion'
import { formatDistanceToNow } from 'date-fns'
import type { ActivityLog } from '@/types/project'

export const Route = createFileRoute('/projects/$projectId/')({
  component: ProjectOverview,
})

/* ═══════════════════════════════════════════════ */

const activityIcons: Record<ActivityLog['type'], typeof Rocket> = {
  publish: Rocket,
  promote: ArrowUpRight,
  rollback: RotateCcw,
  table_create: Plus,
  table_delete: Trash2,
  table_update: Pencil,
  row_add: Plus,
  row_delete: Trash2,
}

const activityColors: Record<ActivityLog['type'], string> = {
  publish: 'text-green-600 dark:text-green-400 border-green-500/40',
  promote: 'text-blue-600 dark:text-blue-400 border-blue-500/40',
  rollback: 'text-amber-600 dark:text-amber-400 border-amber-500/40',
  table_create: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40',
  table_delete: 'text-red-600 dark:text-red-400 border-red-500/40',
  table_update: 'text-muted-foreground border-border',
  row_add: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40',
  row_delete: 'text-red-600 dark:text-red-400 border-red-500/40',
}

function CopyableField({
  label,
  value,
  secret = false,
}: {
  label: string
  value: string
  secret?: boolean
}) {
  const [visible, setVisible] = useState(!secret)

  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-1.5">
        <Input
          readOnly
          value={visible ? value : '•'.repeat(Math.min(value.length, 40))}
          className="font-mono text-xs h-8"
        />
        {secret && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setVisible(!visible)}
          >
            {visible ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(value)
            toast.success(`${label} copied`)
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════ */

function QuickStartCard({ project }: { project: Project }) {
  const [tab, setTab] = useState<'install' | 'usage' | 'mcp'>('install')
  const gitUrl = 'https://github.com/your-studio/unity-flux-sdk.git'
  const envName =
    project.environment.charAt(0).toUpperCase() + project.environment.slice(1)
  const cdnUrl = project.r2BucketUrl || 'https://flux-cdn.yourstudio.com'

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Quick Start - Unity</CardTitle>
          <div className="flex gap-1 bg-muted rounded-md p-0.5">
            <button
              onClick={() => setTab('install')}
              className={cn(
                'px-2.5 py-1 text-[11px] font-medium rounded transition-colors',
                tab === 'install'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Installation
            </button>
            <button
              onClick={() => setTab('usage')}
              className={cn(
                'px-2.5 py-1 text-[11px] font-medium rounded transition-colors',
                tab === 'usage'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Usage
            </button>
            <button
              onClick={() => setTab('mcp')}
              className={cn(
                'px-2.5 py-1 text-[11px] font-medium rounded transition-colors',
                tab === 'mcp'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              MCP
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {tab === 'install' ? (
          <div className="space-y-2.5">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">1.</span> Open{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                Window &gt; Package Manager
              </code>{' '}
              in Unity
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">2.</span> Click{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                + &gt; Add package from git URL
              </code>
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">3.</span> Paste this URL:
            </p>
            <div className="relative group">
              <pre className="bg-muted p-2.5 rounded-lg text-[11px] font-mono overflow-x-auto pr-10">
                {gitUrl}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  navigator.clipboard.writeText(gitUrl)
                  toast.success('URL copied')
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">4.</span> Create{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                FluxConfig.asset
              </code>{' '}
              via{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                Assets &gt; Create &gt; Flux Config
              </code>
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">5.</span> Fill in Project ID and Anonymous Key from credentials above
            </p>
          </div>
        ) : tab === 'usage' ? (
          <div className="relative group">
            <pre className="bg-muted p-3 rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed pr-10">
              {`// Initialize in GameManager.cs
FluxManager.Instance.Configure(
  new FluxConfig {
    ProjectSlug = "${project.slug}",
    Environment = FluxEnvironment.${envName},
    CdnBaseUrl  = "${cdnUrl}",
    AnonKey     = "${project.anonKey.substring(0, 10)}..."
  }
);

await FluxManager.Instance.InitializeAsync();
await FluxManager.Instance.SyncAsync();`}
            </pre>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => {
                navigator.clipboard.writeText(
                  `FluxManager.Instance.Configure(\n  new FluxConfig {\n    ProjectSlug = "${project.slug}",\n    Environment = FluxEnvironment.${envName},\n    CdnBaseUrl  = "${cdnUrl}",\n    AnonKey     = "${project.anonKey}"\n  }\n);\n\nawait FluxManager.Instance.InitializeAsync();\nawait FluxManager.Instance.SyncAsync();`,
                )
                toast.success('Code copied')
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Add this to your{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                .claude/settings.local.json
              </code>{' '}
              to let AI agents manage this project:
            </p>
            <div className="relative group">
              <pre className="bg-muted p-3 rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed pr-10">
                {JSON.stringify({
                  mcpServers: {
                    unity_flux: {
                      type: 'url',
                      url: 'http://localhost:3001/mcp',
                    },
                  },
                }, null, 2)}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  navigator.clipboard.writeText(
                    JSON.stringify({
                      mcpServers: {
                        unity_flux: {
                          type: 'url',
                          url: 'http://localhost:3001/mcp',
                        },
                      },
                    }, null, 2),
                  )
                  toast.success('Config copied')
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-3">Example prompts:</p>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-1.5 rounded">
                "Create a table called Weapons with columns: name (string), damage (integer), rarity (enum: common, rare, epic)"
              </p>
              <p className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-1.5 rounded">
                "Add 5 rows of sample weapon data to the Weapons table"
              </p>
              <p className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-1.5 rounded">
                "Publish current data to staging"
              </p>
              <p className="text-[11px] text-muted-foreground font-mono bg-muted px-2 py-1.5 rounded">
                "Generate C# classes for this project"
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ProjectOverview() {
  const { projectId } = useParams({ from: '/projects/$projectId/' })
  const project = useProjectStore((s) => s.getProject(projectId))
  const updateProject = useProjectStore((s) => s.updateProject)
  const regenerateApiKey = useProjectStore((s) => s.regenerateApiKey)
  const activities = useProjectStore(
    useShallow((s) =>
      s.activities
        .filter((a) => a.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20),
    ),
  )

  if (!project) return null

  return (
    <PageTransition className="p-6 space-y-5">
      {/* Description */}
      {project.description && (
        <p className="text-sm text-muted-foreground">{project.description}</p>
      )}

      {/* Main grid: left 3/5, right 2/5 */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Activity — right 2/5, stretches to match left */}
        <div className="lg:col-span-2 lg:order-2">
          <Card className="flex flex-col max-h-[710px]">
            <CardHeader className="pb-2 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Recent Activity</CardTitle>
                <Link
                  to="/projects/$projectId/versions"
                  params={{ projectId }}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Versions
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {activities.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No activity yet
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Create tables and publish versions to see activity here.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[13px] top-3 bottom-3 w-px bg-border" />
                  <div className="space-y-0">
                    {activities.map((a) => {
                      const Icon = activityIcons[a.type] ?? Clock
                      return (
                        <div key={a.id} className="flex gap-3 py-2 relative">
                          <div
                            className={cn(
                              'relative z-10 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border bg-background',
                              activityColors[a.type],
                            )}
                          >
                            <Icon className="h-3 w-3" />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-sm leading-tight">
                              {a.message}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {formatDistanceToNow(new Date(a.createdAt), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Left column — 3/5 */}
        <div className="lg:col-span-3 lg:order-1 space-y-5">
          {/* SDK Credentials */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">SDK Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CopyableField label="Project ID" value={project.id} />
              <CopyableField label="Project Slug" value={project.slug} />

              <Separator />

              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">
                  API Key
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    readOnly
                    value={'•'.repeat(20)}
                    className="font-mono text-xs h-8"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(project.apiKey)
                      toast.success('API Key copied')
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      regenerateApiKey(project.id)
                      toast.success('API key regenerated')
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Server-side only.
                </p>
              </div>

              <CopyableField
                label="Anonymous Key (Client-safe)"
                value={project.anonKey}
                secret
              />
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">
                  Supabase URL
                </Label>
                <Input
                  placeholder="https://your-project.supabase.co"
                  value={project.supabaseUrl}
                  onChange={(e) =>
                    updateProject(project.id, { supabaseUrl: e.target.value })
                  }
                  className="text-xs h-8"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">
                  R2 Bucket URL
                </Label>
                <Input
                  placeholder="https://flux-cdn.yourstudio.com"
                  value={project.r2BucketUrl}
                  onChange={(e) =>
                    updateProject(project.id, { r2BucketUrl: e.target.value })
                  }
                  className="text-xs h-8"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">
                  Environment
                </Label>
                <Select
                  value={project.environment}
                  onValueChange={(
                    value: 'development' | 'staging' | 'production',
                  ) => updateProject(project.id, { environment: value })}
                >
                  <SelectTrigger className="h-8 text-xs">
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

        </div>
      </div>

      {/* Quick Start — full width */}
      <QuickStartCard project={project} />
    </PageTransition>
  )
}
