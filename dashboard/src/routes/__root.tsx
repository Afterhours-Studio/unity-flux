import { createRootRouteWithContext, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/app/layout'
import { useAuthStore } from '@/stores/auth-store'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  const location = useLocation()
  const navigate = useNavigate()
  const isLoginPage = location.pathname === '/login'
  const isAuthPage = location.pathname.startsWith('/auth')
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const initialize = useAuthStore((s) => s.initialize)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!initialized) {
      initialize().then(() => setInitialized(true))
    }
  }, [initialize, initialized])

  useEffect(() => {
    if (!loading && initialized) {
      if (!user && !isLoginPage && !isAuthPage) {
        navigate({ to: '/login' })
      } else if (user && isLoginPage) {
        navigate({ to: '/' })
      }
    }
  }, [user, loading, initialized, isLoginPage, navigate])

  if (loading || !initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src="/flux-icon.png" alt="Flux" className="h-12 w-12 rounded-2xl shadow-lg" />
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!user && !isLoginPage && !isAuthPage) return null
  if (user && isLoginPage) return null

  if (isLoginPage || isAuthPage) {
    return (
      <>
        <Outlet />
        {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
      </>
    )
  }

  return (
    <>
      <AppLayout>
        <Outlet />
      </AppLayout>
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  )
}
