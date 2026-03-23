import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { DataStore } from './store/data-store.js'
import { JsonStore } from './store/json-store.js'
import { PostgresStore } from './store/postgres-store.js'
import { createApiRouter } from './api/routes.js'
import { WebhookDispatcher } from './api/webhook-dispatcher.js'
import { McpDashboardProxy } from './mcp/proxy.js'
import { registerProxyTools } from './mcp/register-tools.js'
import { resolve } from 'node:path'

const PORT = parseInt(process.env.PORT || '3001', 10)
const STORAGE = process.env.STORAGE_PROVIDER || 'postgres'

// Create data store based on env
let store: DataStore
if (STORAGE === 'json') {
  const DATA_PATH = process.env.UNITY_FLUX_DATA_PATH || resolve(import.meta.dirname, '../data/store.json')
  store = new JsonStore(DATA_PATH)
  console.log(`Storage: JSON file (${DATA_PATH})`)
} else {
  const DB_URL = process.env.DATABASE_URL || 'postgresql://flux:flux_local_dev@localhost:5432/unity_flux'
  store = new PostgresStore(DB_URL)
  console.log(`Storage: PostgreSQL (${DB_URL.replace(/:[^@]*@/, ':***@')})`)
}

const webhookDispatcher = new WebhookDispatcher(store)

const app = express()
const httpServer = createServer(app)

app.use(express.json())
app.use(cors({ origin: true }))

// ─── WebSocket proxy (Dashboard ↔ MCP) ──────────────
const proxy = new McpDashboardProxy(httpServer)

// ─── REST API (Dashboard → DB) ──────────────────────
app.use('/api', createApiRouter(store, webhookDispatcher))

app.use('/api', (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API error:', err.message)
  res.status(500).json({ error: err.message })
})

// ─── MCP endpoint (AI Agent → proxy → Dashboard) ────
// Session management: keep server+transport alive across requests
const mcpSessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>()

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined

  if (sessionId && mcpSessions.has(sessionId)) {
    // Existing session — reuse server+transport
    const { transport } = mcpSessions.get(sessionId)!
    await transport.handleRequest(req, res, req.body)
  } else if (!sessionId) {
    // New session — create server+transport pair
    const server = new McpServer({ name: 'unity-flux', version: '0.1.0' })
    registerProxyTools(server, proxy)

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    })

    transport.onclose = () => {
      const sid = transport.sessionId
      if (sid) mcpSessions.delete(sid)
    }

    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)

    const sid = transport.sessionId
    if (sid) {
      mcpSessions.set(sid, { server, transport })
    }
  } else {
    // Session ID provided but not found — expired or invalid
    res.status(404).json({ error: 'Session not found. Send an initialize request without a session ID to start a new session.' })
  }
})

app.get('/mcp', (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (sessionId && mcpSessions.has(sessionId)) {
    const { transport } = mcpSessions.get(sessionId)!
    transport.handleRequest(req, res)
  } else {
    res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed. Use POST for initialization.' }))
  }
})

app.delete('/mcp', (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (sessionId && mcpSessions.has(sessionId)) {
    const { transport } = mcpSessions.get(sessionId)!
    transport.close()
    mcpSessions.delete(sessionId)
    res.status(200).json({ message: 'Session closed.' })
  } else {
    res.status(404).json({ error: 'Session not found.' })
  }
})

// ─── Status endpoint ─────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json({
    storage: STORAGE,
    dashboardConnected: proxy.isConnected,
  })
})

httpServer.listen(PORT, () => {
  console.log(`Unity Flux server running at http://localhost:${PORT}`)
  console.log(`  REST API:   http://localhost:${PORT}/api`)
  console.log(`  MCP:        http://localhost:${PORT}/mcp`)
  console.log(`  WebSocket:  ws://localhost:${PORT}/ws`)
})
