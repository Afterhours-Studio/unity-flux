import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface UserProfile {
  id: string
  display_name: string
  role: 'admin' | 'editor' | 'viewer'
  created_at: string
}

interface AuthStore {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  isAdmin: boolean

  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>

  // Profile
  fetchProfile: () => Promise<void>
  updateDisplayName: (name: string) => Promise<void>
  changePassword: (newPassword: string) => Promise<void>
  uploadAvatar: (file: File) => Promise<string>
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAdmin: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    set({
      session,
      user: session?.user ?? null,
      loading: false,
    })

    // Fetch profile if logged in
    if (session?.user) {
      get().fetchProfile()
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        loading: false,
      })
      if (session?.user) {
        get().fetchProfile()
      } else {
        set({ profile: null, isAdmin: false })
      }
    })
  },

  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null, isAdmin: false })
  },

  fetchProfile: async () => {
    const user = get().user
    if (!user) return

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, display_name, role, created_at')
      .eq('id', user.id)
      .single()

    console.log('[Auth] fetchProfile result:', { data, error, userId: user.id })

    if (data && !error) {
      const role = (data.role as string) || 'editor'
      const profile: UserProfile = {
        id: data.id as string,
        display_name: (data.display_name as string) || '',
        role: role as 'admin' | 'editor' | 'viewer',
        created_at: (data.created_at as string) || '',
      }
      console.log('[Auth] Profile loaded:', profile)
      set({ profile, isAdmin: role === 'admin' })
    } else {
      // Row doesn't exist or RLS blocked - use auth metadata as fallback
      console.log('[Auth] No profile row, using fallback. Error:', error?.message)
      const role = (user.app_metadata?.role as string) || (user.user_metadata?.role as string) || 'editor'
      const fallback: UserProfile = {
        id: user.id,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || '',
        role: role as 'admin' | 'editor' | 'viewer',
        created_at: user.created_at || new Date().toISOString(),
      }
      set({ profile: fallback, isAdmin: role === 'admin' })

      // Try to create profile row only if it doesn't exist (don't overwrite existing role)
      await supabase.from('user_profiles').upsert({
        id: user.id,
        display_name: fallback.display_name,
        role: 'editor',
      }, { onConflict: 'id', ignoreDuplicates: true })
    }
  },

  updateDisplayName: async (name: string) => {
    const user = get().user
    if (!user) throw new Error('Not authenticated')

    // Update Supabase auth metadata
    const { error } = await supabase.auth.updateUser({
      data: { display_name: name },
    })
    if (error) throw new Error(error.message)

    // Update user_profiles table
    await supabase
      .from('user_profiles')
      .update({ display_name: name })
      .eq('id', user.id)

    // Refresh local state
    const { data: { user: updated } } = await supabase.auth.getUser()
    if (updated) set({ user: updated })
    await get().fetchProfile()
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const user = get().user
    if (!user?.email) throw new Error('Not authenticated')

    // Verify current password by re-authenticating
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (verifyError) throw new Error('Current password is incorrect')

    // Update to new password
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(error.message)
  },

  uploadAvatar: async (file: File) => {
    const user = get().user
    if (!user) throw new Error('Not authenticated')

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}.${ext}`

    // Upload to avatars bucket
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (uploadError) throw new Error(uploadError.message)

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    // Add cache buster
    const url = `${publicUrl}?t=${Date.now()}`

    // Update user metadata
    const { error } = await supabase.auth.updateUser({
      data: { avatar_url: url },
    })
    if (error) throw new Error(error.message)

    // Refresh
    const { data: { user: updated } } = await supabase.auth.getUser()
    if (updated) set({ user: updated })

    return url
  },
}))
