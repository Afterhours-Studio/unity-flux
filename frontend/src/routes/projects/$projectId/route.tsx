import { createFileRoute, Outlet, Link, useParams } from '@tanstack/react-router'
import { Database, TableProperties, History, KeyRound, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores/project-store'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectLayout,
})

const projectNavItems = [
  { to: '/projects/$projectId' as const, label: 'Overview', icon: KeyRound, exact: true },
  { to: '/projects/$projectId/schemas' as const, label: 'Schemas', icon: Database, exact: false },
  { to: '/projects/$projectId/entries' as const, label: 'Entries', icon: TableProperties, exact: false },
  { to: '/projects/$projectId/versions' as const, label: 'Versions', icon: History, exact: false },
]

function ProjectLayout() {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  const project = useProjectStore((s) => s.getProject(projectId))

  if (!project) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Project not found</h1>
        <Link to="/" className="text-primary mt-2 inline-block hover:underline">
          Back to projects
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Project sub-sidebar */}
      <aside className="flex w-56 flex-col border-r border-border bg-muted/30">
        <div className="p-3 border-b border-border">
          <Link to="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2">
            <ArrowLeft className="h-3 w-3" />
            All Projects
          </Link>
          <h2 className="font-semibold text-sm truncate">{project.name}</h2>
          <p className="text-xs text-muted-foreground truncate">{project.slug}</p>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {projectNavItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              params={{ projectId }}
              activeOptions={{ exact: item.exact }}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
              activeProps={{
                className: 'bg-accent text-accent-foreground font-medium',
              }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
