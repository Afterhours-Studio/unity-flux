import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'node:http'
import { randomUUID } from 'node:crypto'

export interface ToolCallResult {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

interface PendingCall {
  resolve: (result: ToolCallResult) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const TOOL_TIMEOUT_MS = 30_000

export class McpDashboardProxy {
  private wss: WebSocketServer
  private dashboard: WebSocket | null = null
  private pending = new Map<string, PendingCall>()

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' })

    this.wss.on('connection', (ws) => {
      console.log('[WS] Dashboard connected')
      this.dashboard = ws

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString())
          if (msg.requestId && this.pending.has(msg.requestId)) {
            const p = this.pending.get(msg.requestId)!
            clearTimeout(p.timer)
            this.pending.delete(msg.requestId)

            if (msg.error) {
              p.resolve({
                content: [{ type: 'text', text: `Error: ${msg.error}` }],
                isError: true,
              })
            } else {
              p.resolve({
                content: [{ type: 'text', text: JSON.stringify(msg.result, null, 2) }],
              })
            }
          }
        } catch {
          // ignore malformed messages
        }
      })

      ws.on('close', () => {
        console.log('[WS] Dashboard disconnected')
        if (this.dashboard === ws) this.dashboard = null
        // Reject all pending calls
        for (const [id, p] of this.pending) {
          clearTimeout(p.timer)
          p.resolve({
            content: [{ type: 'text', text: 'Error: Dashboard disconnected' }],
            isError: true,
          })
        }
        this.pending.clear()
      })
    })
  }

  get isConnected(): boolean {
    return this.dashboard?.readyState === WebSocket.OPEN
  }

  async executeTool(name: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    if (!this.isConnected) {
      return {
        content: [{ type: 'text', text: 'Error: Dashboard is not connected. Open the dashboard first.' }],
        isError: true,
      }
    }

    const requestId = randomUUID()

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        resolve({
          content: [{ type: 'text', text: 'Error: Dashboard did not respond in time (30s timeout).' }],
          isError: true,
        })
      }, TOOL_TIMEOUT_MS)

      this.pending.set(requestId, { resolve, reject: () => {}, timer })

      this.dashboard!.send(JSON.stringify({
        type: 'tool_call',
        requestId,
        name,
        params,
      }))
    })
  }
}
