import { createRootRouteWithContext, Outlet, useLocation, redirect } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { DashboardLayout } from '@/app/layout'
import { useAuthStore } from '@/stores/auth-store'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: ({ location }) => {
    const user = useAuthStore.getState().user
    const isLoginPage = location.pathname === '/login'

    if (!user && !isLoginPage) {
      throw redirect({ to: '/login' })
    } else if (user && isLoginPage) {
      throw redirect({ to: '/' })
    }
  },
  component: RootComponent,
})

function RootComponent() {
  const location = useLocation()
  const isLoginPage = location.pathname === '/login'

  // Login page: no sidebar
  if (isLoginPage) {
    return (
      <>
        <Outlet />
        {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
      </>
    )
  }

  // Authenticated: with sidebar
  return (
    <>
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  )
}
