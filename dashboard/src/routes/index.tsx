import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, Gamepad2, Calendar, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjectStore } from '@/stores/project-store'
import { CreateProjectDialog } from '@/features/projects/create-project-dialog'
import { generateSeedData } from '@/lib/seed-data'
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { PageTransition, motion, staggerContainer, staggerItem } from '@/components/motion'

export const Route = createFileRoute('/')({
  component: ProjectListPage,
})

function ProjectListPage() {
  const projects = useProjectStore((s) => s.projects)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <PageTransition className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage your game configurations across multiple titles.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <Gamepad2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground text-sm mb-6 text-center max-w-sm">
                Create your first project to start managing game configurations
                with over-the-air updates.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    useProjectStore.setState(generateSeedData())
                    window.location.reload()
                  }}
                >
                  <Gamepad2 className="h-4 w-4 mr-2" />
                  Load Demo Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {projects.map((project) => (
            <motion.div key={project.id} variants={staggerItem}>
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                className="group block"
              >
                <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Gamepad2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{project.name}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {project.slug}
                          </CardDescription>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </PageTransition>
  )
}
