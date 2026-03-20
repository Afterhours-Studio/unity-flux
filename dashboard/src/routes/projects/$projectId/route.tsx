import { createFileRoute, Outlet, Link, useParams } from '@tanstack/react-router'
import { Database, History, KeyRound, ArrowLeft, Settings, Code, CalendarDays, FunctionSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProjectIcon } from '@/components/project-icon'
import { useProject } from '@/hooks/use-projects'
import { Loader2 } from 'lucide-react'
import { motion } from '@/components/motion'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectLayout,
})

const projectNavItems = [
  { to: '/projects/$projectId' as const, labelKey: 'nav.overview', icon: KeyRound, exact: true },
  { to: '/projects/$projectId/data' as const, labelKey: 'nav.data', icon: Database, exact: false },
  { to: '/projects/$projectId/formulas' as const, labelKey: 'nav.formulas', icon: FunctionSquare, exact: false },
  { to: '/projects/$projectId/versions' as const, labelKey: 'nav.versions', icon: History, exact: false },
  { to: '/projects/$projectId/live-ops' as const, labelKey: 'nav.liveOps', icon: CalendarDays, exact: false },
  { to: '/projects/$projectId/codegen' as const, labelKey: 'nav.codegen', icon: Code, exact: false },
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
  const { data: project, isLoading } = useProject(projectId)
  const { width: sidebarWidth, onMouseDown } = useSidebarResize()
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="text-xl font-semibold">{t('projects.notFound')}</h1>
          <Link to="/" className="text-sm text-primary hover:underline">
            {t('projects.backToProjects')}
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
        className="relative flex flex-col border-r border-sidebar-border/50 bg-[var(--sidebar-bg)] backdrop-blur-xl backdrop-saturate-150 shrink-0"
        style={{ width: sidebarWidth }}
      >
        <div className="p-4 border-b border-sidebar-border/40 space-y-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors group"
          >
            <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
            {t('projects.title')}
          </Link>
          <div className="flex items-center gap-2.5">
            <ProjectIcon icon={project.icon} name={project.name} size="sm" />
            <div className="min-w-0">
              <h2 className="font-semibold text-[15px] text-sidebar-foreground truncate leading-tight">
                {project.name}
              </h2>
              <p className="text-xs text-sidebar-foreground/50 truncate leading-tight">
                {project.slug}
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {projectNavItems.map((item) => (
            <Link
              key={item.labelKey}
              to={item.to}
              params={{ projectId }}
              activeOptions={{ exact: item.exact }}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40',
              )}
              activeProps={{
                className:
                  'bg-primary/12 text-primary hover:bg-primary/18 hover:text-primary',
              }}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        {/* Settings - pinned bottom */}
        <div className="border-t border-sidebar-border/40 p-3">
          <Link
            to="/projects/$projectId/settings"
            params={{ projectId }}
            activeOptions={{ exact: false }}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
              'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40',
            )}
            activeProps={{
              className:
                'bg-primary/12 text-primary hover:bg-primary/18 hover:text-primary',
            }}
          >
            <Settings className="h-[18px] w-[18px] shrink-0" />
            {t('nav.settings')}
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
