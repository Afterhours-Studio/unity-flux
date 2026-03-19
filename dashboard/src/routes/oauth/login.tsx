import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/oauth/login')({
  component: OAuthLoginPage,
})

function OAuthLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'login' | 'authorizing' | 'done'>('login')

  // Read OAuth params from URL
  const params = new URLSearchParams(window.location.search)
  const clientId = params.get('client_id')
  const redirectUri = params.get('redirect_uri')
  const codeChallenge = params.get('code_challenge')
  const state = params.get('state')
  const scope = params.get('scope')
  const resource = params.get('resource')

  if (!clientId || !redirectUri || !codeChallenge) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Request</CardTitle>
            <CardDescription>Missing required OAuth parameters.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.')
      return
    }

    setLoading(true)
    setStatus('login')

    // Step 1: Login with Supabase
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (loginError || !data.session) {
      setError(loginError?.message ?? 'Login failed')
      setLoading(false)
      return
    }

    setStatus('authorizing')

    // Step 2: Exchange Supabase token for OAuth authorization code
    try {
      const resp = await fetch('/api/oauth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabase_token: data.session.access_token,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          state,
          scope,
          resource,
        }),
      })

      const result = await resp.json()

      if (!resp.ok) {
        setError(result.error_description ?? result.error ?? 'Authorization failed')
        setLoading(false)
        setStatus('login')
        return
      }

      // Step 3: Redirect back to client with authorization code
      setStatus('done')

      // Sign out from dashboard session (OAuth login is separate)
      await supabase.auth.signOut()

      window.location.href = result.redirect_url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authorization failed')
      setLoading(false)
      setStatus('login')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Authorize MCP Access</CardTitle>
          <CardDescription>
            Sign in to grant access to Unity Flux MCP tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'done' ? (
            <div className="text-center py-4 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Redirecting back to client...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-md p-2">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {status === 'authorizing' ? 'Authorizing...' : 'Signing in...'}
                  </>
                ) : (
                  'Sign in & Authorize'
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                This will grant MCP tools access to your Unity Flux data.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
