import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  username: string
  displayName: string
  avatar?: string
}

interface AuthStore {
  user: User | null
  login: (username: string, password: string) => boolean
  logout: () => void
}

const TEST_ACCOUNTS: Record<string, { password: string; user: User }> = {
  admin: {
    password: 'admin',
    user: {
      username: 'admin',
      displayName: 'Admin',
    },
  },
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,

      login: (username, password) => {
        const account = TEST_ACCOUNTS[username]
        if (account && account.password === password) {
          set({ user: account.user })
          return true
        }
        return false
      },

      logout: () => {
        set({ user: null })
      },
    }),
    {
      name: 'unity-flux-auth',
    },
  ),
)
