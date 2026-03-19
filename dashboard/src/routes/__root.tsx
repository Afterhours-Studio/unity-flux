import { createRootRouteWithContext, Outlet, useLocation, redirect } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/app/layout'
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

  if (isLoginPage) {
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
