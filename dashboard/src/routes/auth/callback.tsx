import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const timeout = setTimeout(() => {
      setError('Authentication timed out. Please try again or contact your admin.')
    }, 15000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      clearTimeout(timeout)

      if (event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          // User arrived via invite or recovery link — send to set password
          navigate({ to: '/auth/set-password' })
          return
        }
      }

      if (event === 'SIGNED_IN' && session?.user) {
        // Already has password set, go to dashboard
        navigate({ to: '/' })
        return
      }
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [navigate])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-destructive/10 text-destructive text-lg font-bold">
            !
          </div>
          <p className="text-sm text-destructive">{error}</p>
          <a
            href="/login"
            className="text-sm text-primary underline hover:text-primary/80"
          >
            Back to login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-lg font-bold shadow-lg">
          UF
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Verifying your invitation...</p>
      </div>
    </div>
  )
}
