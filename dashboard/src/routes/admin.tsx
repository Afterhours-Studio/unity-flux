import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Shield, UserPlus, MoreHorizontal, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { PageTransition } from '@/components/motion'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

interface UserRow {
  id: string
  email: string
  display_name: string
  role: string
  avatar_url: string | null
  created_at: string
  last_sign_in_at: string | null
}

function AdminPage() {
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    if (!isAdmin) {
      navigate({ to: '/' })
      return
    }
    fetchUsers()
  }, [isAdmin, navigate])

  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to load users')
      setLoading(false)
      return
    }

    const rows: UserRow[] = (data || []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      email: (p.email as string) || '',
      display_name: (p.display_name as string) || '',
      role: (p.role as string) || 'editor',
      avatar_url: (p.avatar_url as string) || null,
      created_at: p.created_at as string,
      last_sign_in_at: null,
    }))

    setUsers(rows)
    setLoading(false)
  }

  const handleChangeRole = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      toast.error('Failed to update role')
      return
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
    )
    toast.success(`Role updated to ${newRole}`)
  }

  if (!isAdmin) return null

  return (
    <PageTransition className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              User Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage accounts, roles, and permissions.
            </p>
          </div>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const initials =
                    u.display_name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || '?'

                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {u.avatar_url && (
                              <AvatarImage src={u.avatar_url} />
                            )}
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {u.display_name || '(no name)'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {u.email || u.id.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            u.role === 'admin' ? 'default' : 'secondary'
                          }
                          className="text-xs"
                        >
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                handleChangeRole(
                                  u.id,
                                  u.role === 'admin' ? 'user' : 'admin',
                                )
                              }
                            >
                              {u.role === 'admin'
                                ? 'Demote to User'
                                : 'Promote to Admin'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                toast.info(
                                  'Account deletion requires Supabase Admin API',
                                )
                              }}
                            >
                              Delete Account
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invite Dialog */}
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={fetchUsers} />
    </PageTransition>
  )
}

function InviteUserDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onInvited: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('user')
  const [sending, setSending] = useState(false)

  const handleInvite = async () => {
    if (!email.trim()) return
    setSending(true)

    try {
      // Note: inviteUserByEmail requires service_role key (admin API)
      // For now, show the signup link approach
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: Math.random().toString(36).slice(2) + 'A1!',
        options: {
          data: { display_name: email.split('@')[0] },
        },
      })

      if (error) throw error

      toast.success(`Invitation sent to ${email}`)
      setEmail('')
      setRole('user')
      onOpenChange(false)
      onInvited()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to invite user',
      )
    }

    setSending(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation to join the dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4 space-y-4">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="px-6 pb-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={sending || !email.trim()}>
            {sending ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
