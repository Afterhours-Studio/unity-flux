import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthStore {
  user: User | null
  session: Session | null
  loading: boolean
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  session: null,
  loading: true,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    set({
      session,
      user: session?.user ?? null,
      loading: false,
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        loading: false,
      })
    })
  },

  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },
}))
