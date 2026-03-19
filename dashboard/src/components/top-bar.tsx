import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut, Sun, Moon, Bell, User, Plug, Shield, Camera, Check, X, Eye, EyeOff, Pencil } from 'lucide-react'
import { useMcpStore, mcpClient } from '@/lib/mcp-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useThemeStore } from '@/stores/theme-store'

export function TopBar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const { theme, setTheme } = useThemeStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const mcpStatus = useMcpStore((s) => s.status)
  const lastToolCall = useMcpStore((s) => s.lastToolCall)

  useEffect(() => {
    mcpClient.connect()
    return () => mcpClient.disconnect()
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate({ to: '/login' })
  }

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '?'
  const userEmail = user?.email || ''
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

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
          {/* Admin */}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="User Management"
            >
              <Shield className="h-4 w-4 text-muted-foreground" />
            </Link>
          )}

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
                  {user?.user_metadata?.avatar_url && <AvatarImage src={user.user_metadata.avatar_url} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {userEmail}
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
            <ProfileContent />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Profile Content ──────────────────────────────────

function ProfileContent() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName)
  const changePassword = useAuthStore((s) => s.changePassword)
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar)

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || ''
  const userEmail = user?.email || ''
  const avatarUrl = user?.user_metadata?.avatar_url || ''
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  // Inline name edit
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(displayName)
  const [savingName, setSavingName] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  // Avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Password
  const [showPassword, setShowPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const handleSaveName = async () => {
    if (!nameValue.trim() || nameValue === displayName) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    try {
      await updateDisplayName(nameValue.trim())
      toast.success('Display name updated')
      setEditingName(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update name')
    }
    setSavingName(false)
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB')
      return
    }
    setUploadingAvatar(true)
    try {
      await uploadAvatar(file)
      toast.success('Avatar updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload avatar')
    }
    setUploadingAvatar(false)
    e.target.value = ''
  }

  // Password strength check
  const passwordErrors: string[] = []
  if (newPassword.length > 0) {
    if (newPassword.length < 8) passwordErrors.push('At least 8 characters')
    if (!/[A-Z]/.test(newPassword)) passwordErrors.push('One uppercase letter')
    if (!/[a-z]/.test(newPassword)) passwordErrors.push('One lowercase letter')
    if (!/[0-9]/.test(newPassword)) passwordErrors.push('One number')
    if (!/[^A-Za-z0-9]/.test(newPassword)) passwordErrors.push('One special character')
  }
  const passwordValid = newPassword.length > 0 && passwordErrors.length === 0

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Enter your current password')
      return
    }
    if (!passwordValid) {
      toast.error('Password does not meet requirements')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSavingPassword(true)
    try {
      await changePassword(currentPassword, newPassword)
      toast.success('Password changed')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPassword(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password')
    }
    setSavingPassword(false)
  }

  return (
    <>
      {/* Avatar + Name */}
      <div className="flex items-center gap-4">
        {/* Avatar with hover overlay */}
        <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
          <Avatar className="h-16 w-16">
            {avatarUrl && <AvatarImage src={avatarUrl} />}
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
              {uploadingAvatar ? '...' : initials}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="h-4 w-4 text-white" />
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        {/* Name (inline edit) */}
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-1">
              <Input
                ref={nameRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') { setEditingName(false); setNameValue(displayName) }
                }}
                className="h-8 text-sm font-medium px-2 -mx-0"
                autoFocus
                disabled={savingName}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={handleSaveName}
                disabled={savingName}
              >
                <Check className="h-3.5 w-3.5 text-primary" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() => { setEditingName(false); setNameValue(displayName) }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button
              className="group/name flex items-center gap-2 hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors w-full text-left"
              onClick={() => { setEditingName(true); setNameValue(displayName) }}
            >
              <span className="font-medium truncate">{displayName}</span>
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
            </button>
          )}
          <p className="text-sm text-muted-foreground px-2 -mx-2">{userEmail}</p>
        </div>
      </div>

      <Separator />

      {/* Account Info */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Role</span>
          <Badge variant={profile?.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
            {profile?.role || 'editor'}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Member since</span>
          <span className="text-xs">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</span>
        </div>
        {user?.last_sign_in_at && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last login</span>
            <span className="text-xs">{new Date(user.last_sign_in_at).toLocaleString()}</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Change Password */}
      <div>
        <button
          className="flex items-center justify-between w-full text-sm font-medium py-1"
          onClick={() => setShowPassword(!showPassword)}
        >
          Change Password
          <span className="text-xs text-muted-foreground">{showPassword ? 'Hide' : 'Show'}</span>
        </button>

        {showPassword && (
          <div className="mt-3 space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="text-sm pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPw(!showNewPw)}
                >
                  {showNewPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {newPassword.length > 0 && passwordErrors.length > 0 && (
                <div className="space-y-1 mt-1">
                  {['At least 8 characters', 'One uppercase letter', 'One lowercase letter', 'One number', 'One special character'].map((req) => {
                    const met = !passwordErrors.includes(req)
                    return (
                      <div key={req} className="flex items-center gap-1.5 text-[11px]">
                        <div className={`h-1.5 w-1.5 rounded-full ${met ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                        <span className={met ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>{req}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="text-sm"
              />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
            <Button
              size="sm"
              onClick={handleChangePassword}
              disabled={savingPassword || !currentPassword || !passwordValid || newPassword !== confirmPassword}
              className="w-full"
            >
              {savingPassword ? 'Saving...' : 'Update Password'}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
