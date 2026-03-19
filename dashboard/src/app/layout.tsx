import type { ReactNode } from 'react'
import { TopBar } from '@/components/top-bar'
import { useMcpStore } from '@/lib/mcp-client'
import { Bot, X } from 'lucide-react'

function McpChangesBanner() {
  const changes = useMcpStore((s) => s.pendingChanges)
  const dismiss = useMcpStore((s) => s.dismissChanges)

  if (changes.length === 0) return null

  const summary = new Map<string, number>()
  for (const c of changes) {
    const label = c.tool.replace(/_/g, ' ')
    summary.set(label, (summary.get(label) ?? 0) + 1)
  }
  const parts = Array.from(summary.entries()).map(
    ([tool, count]) => (count > 1 ? `${tool} ×${count}` : tool),
  )

  return (
    <div className="flex items-center gap-3 bg-primary/10 border-b border-primary/20 px-5 py-2 text-sm shrink-0">
      <Bot className="h-4 w-4 text-primary shrink-0" />
      <span className="text-primary font-medium">AI made changes</span>
      <span className="text-muted-foreground truncate">
        {parts.join(', ')}
      </span>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <button
          onClick={dismiss}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
          Dismiss
        </button>
      </div>
    </div>
  )
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar />
      <McpChangesBanner />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
