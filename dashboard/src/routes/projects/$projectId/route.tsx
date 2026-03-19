import { createFileRoute, Outlet, Link, useParams } from '@tanstack/react-router'
import { Database, History, KeyRound, ArrowLeft, Settings, Code } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores/project-store'
import { motion } from '@/components/motion'
import { useState, useCallback, useRef, useEffect } from 'react'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectLayout,
})

const projectNavItems = [
  { to: '/projects/$projectId' as const, label: 'Overview', icon: KeyRound, exact: true },
  { to: '/projects/$projectId/data' as const, label: 'Data', icon: Database, exact: false },
  { to: '/projects/$projectId/versions' as const, label: 'Versions', icon: History, exact: false },
  { to: '/projects/$projectId/codegen' as const, label: 'Codegen', icon: Code, exact: false },
]

const SIDEBAR_MIN = 200
const SIDEBAR_MAX = 400
const SIDEBAR_DEFAULT = 240

function useSidebarResize() {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width')
    return saved ? Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Number(saved))) : SIDEBAR_DEFAULT
  })
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - startX.current
      const newWidth = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startWidth.current + delta))
      setWidth(newWidth)
    }
    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('sidebar-width', String(width))
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [width])

  return { width, onMouseDown }
}

function ProjectLayout() {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  const project = useProjectStore((s) => s.getProject(projectId))
  const { width: sidebarWidth, onMouseDown } = useSidebarResize()

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="text-xl font-semibold">Project not found</h1>
          <Link to="/" className="text-sm text-primary hover:underline">
            Back to projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Project sidebar */}
      <motion.aside
        initial={{ x: -sidebarWidth, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] as const }}
        className="relative flex flex-col border-r border-sidebar-border bg-sidebar shrink-0"
        style={{ width: sidebarWidth }}
      >
        <div className="p-4 border-b border-sidebar-border space-y-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors group"
          >
            <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
            All Projects
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0">
              {project.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-sm text-sidebar-foreground truncate leading-tight">
                {project.name}
              </h2>
              <p className="text-[11px] text-sidebar-foreground/50 truncate leading-tight">
                {project.slug}
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {projectNavItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              params={{ projectId }}
              activeOptions={{ exact: item.exact }}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
                'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
              )}
              activeProps={{
                className:
                  'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
              }}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Settings - pinned bottom */}
        <div className="border-t border-sidebar-border p-3">
          <Link
            to="/projects/$projectId/settings"
            params={{ projectId }}
            activeOptions={{ exact: false }}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
              'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
            )}
            activeProps={{
              className:
                'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
            }}
          >
            <Settings className="h-4 w-4 shrink-0" />
            Settings
          </Link>
        </div>
        {/* Resize handle */}
        <div
          onMouseDown={onMouseDown}
          className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-primary/20 active:bg-primary/30 transition-colors"
        />
      </motion.aside>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
