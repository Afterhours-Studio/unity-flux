import { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut, Sun, Moon, Bell, User, Plug } from 'lucide-react'
import { useMcpStore, mcpClient } from '@/lib/mcp-client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeStore } from '@/stores/theme-store'

export function TopBar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const { theme, setTheme } = useThemeStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const mcpStatus = useMcpStore((s) => s.status)
  const lastToolCall = useMcpStore((s) => s.lastToolCall)

  useEffect(() => {
    mcpClient.connect()
    return () => mcpClient.disconnect()
  }, [])

  const handleLogout = () => {
    logout()
    navigate({ to: '/login' })
  }

  const initials =
    user?.displayName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '?'

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-border bg-background px-5 shrink-0">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-xs font-bold shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:scale-105">
            UF
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Unity Flux
          </span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* MCP Status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex h-9 items-center gap-1.5 rounded-lg px-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={`MCP: ${mcpStatus}`}
              >
                <Plug className="h-3.5 w-3.5 text-muted-foreground" />
                <div
                  className={`h-2 w-2 rounded-full ${
                    mcpStatus === 'connected'
                      ? 'bg-emerald-500'
                      : mcpStatus === 'executing'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-muted-foreground/30'
                  }`}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>MCP Connection</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-2 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`font-medium ${mcpStatus === 'connected' ? 'text-emerald-500' : mcpStatus === 'executing' ? 'text-amber-500' : 'text-muted-foreground'}`}>
                    {mcpStatus === 'connected' ? 'Connected' : mcpStatus === 'executing' ? 'Executing...' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Endpoint</span>
                  <code className="text-xs text-muted-foreground">ws://localhost:3001/ws</code>
                </div>
                {lastToolCall && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last tool</span>
                    <code className="text-xs">{lastToolCall.name}</code>
                  </div>
                )}
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                AI agents control the dashboard via MCP. Changes appear in the UI for you to review before saving.
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <Bell className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  No notifications yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Publish events and updates will appear here.
                </p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center rounded-full p-0.5 transition-all duration-200 hover:ring-2 hover:ring-ring/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{user?.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    @{user?.username}
                  </p>
                </div>
                <button
                  onClick={() => setProfileOpen(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Personal settings"
                >
                  <User className="h-4 w-4" />
                </button>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <button
                onClick={toggleTheme}
                className="flex items-center justify-between w-full px-2 py-1.5 rounded-sm hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isDark ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Sun className="h-4 w-4" />
                  )}
                  <span className="text-sm">Theme</span>
                </div>
                <div
                  className={`relative h-5 w-9 rounded-full transition-colors ${isDark ? 'bg-primary' : 'bg-input'}`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform duration-200 ${isDark ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </div>
              </button>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Profile Settings Modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Personal Settings</DialogTitle>
            <DialogDescription>
              Manage your account information.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            {/* Avatar & name */}
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <p className="font-medium">{user?.displayName}</p>
                <p className="text-sm text-muted-foreground">
                  @{user?.username}
                </p>
              </div>
            </div>

            <Separator />

            {/* Editable fields */}
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Display Name
                </Label>
                <Input
                  value={user?.displayName ?? ''}
                  readOnly
                  className="text-sm"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Username
                </Label>
                <Input
                  value={user?.username ?? ''}
                  readOnly
                  className="text-sm"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Account management will be available when Supabase Auth is
              connected.
            </p>
          </div>
          <div className="px-6 pb-6 pt-2 flex justify-end">
            <Button variant="outline" onClick={() => setProfileOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
