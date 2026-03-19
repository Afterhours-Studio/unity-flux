import type { ReactNode } from 'react'
import { TopBar } from '@/components/top-bar'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
