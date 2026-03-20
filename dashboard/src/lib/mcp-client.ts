import { toolExecutors } from './mcp-tools'
import { create } from 'zustand'

type McpStatus = 'disconnected' | 'connected' | 'executing' | 'reconnecting'

interface McpChange {
  tool: string
  timestamp: number
}

interface McpStore {
  status: McpStatus
  lastToolCall: { name: string; timestamp: number } | null
  // Draft tracking — changes made by AI that haven't been "acknowledged"
  pendingChanges: McpChange[]
  setStatus: (s: McpStatus) => void
  setLastToolCall: (name: string) => void
  addPendingChange: (tool: string) => void
  dismissChanges: () => void
}

// Tools that modify state (not read-only)
const MUTATING_TOOLS = new Set([
  'create_project', 'update_project', 'delete_project',
  'create_table', 'rename_table', 'delete_table',
  'add_column', 'update_column', 'remove_column',
  'add_row', 'update_row', 'delete_row',
  'publish_version', 'promote_version', 'rollback_version', 'delete_version',
])

export const useMcpStore = create<McpStore>((set) => ({
  status: 'disconnected',
  lastToolCall: null,
  pendingChanges: [],
  setStatus: (status) => set({ status }),
  setLastToolCall: (name) => {
    set((s) => ({
      lastToolCall: { name, timestamp: Date.now() },
      status: 'connected',
      pendingChanges: MUTATING_TOOLS.has(name)
        ? [...s.pendingChanges, { tool: name, timestamp: Date.now() }]
        : s.pendingChanges,
    }))
  },
  addPendingChange: (tool) =>
    set((s) => ({ pendingChanges: [...s.pendingChanges, { tool, timestamp: Date.now() }] })),
  dismissChanges: () => set({ pendingChanges: [] }),
}))

class McpClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private url: string

  constructor(url = import.meta.env.VITE_MCP_WS_URL || 'ws://localhost:3001/ws') {
    this.url = url
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    // Skip WebSocket connection when running against cloud (no local WS server)
    if (!this.url.startsWith('ws')) return

    try {
      this.ws = new WebSocket(this.url)
      useMcpStore.getState().setStatus('reconnecting')

      this.ws.onopen = () => {
        console.log('[MCP] Connected to server')
        useMcpStore.getState().setStatus('connected')
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'tool_call') {
            this.handleToolCall(msg.requestId, msg.name, msg.params)
          }
        } catch {
          // ignore malformed messages
        }
      }

      this.ws.onclose = () => {
        console.log('[MCP] Disconnected, reconnecting in 3s...')
        useMcpStore.getState().setStatus('disconnected')
        this.scheduleReconnect()
      }

      this.ws.onerror = () => {
        // onclose will fire after this
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    useMcpStore.getState().setStatus('disconnected')
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 3000)
  }

  private async handleToolCall(requestId: string, name: string, params: Record<string, unknown>) {
    useMcpStore.getState().setStatus('executing')

    const executor = toolExecutors[name]
    if (!executor) {
      this.send({ requestId, error: `Unknown tool: ${name}` })
      useMcpStore.getState().setStatus('connected')
      return
    }

    try {
      const result = await executor(params)
      this.send({ requestId, result })
      useMcpStore.getState().setLastToolCall(name)
    } catch (e) {
      this.send({ requestId, error: e instanceof Error ? e.message : String(e) })
      useMcpStore.getState().setStatus('connected')
    }
  }

  private send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }
}

export const mcpClient = new McpClient()
