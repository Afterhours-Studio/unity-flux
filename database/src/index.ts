import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { DataStore } from './store/data-store.js'
import { JsonStore } from './store/json-store.js'
import { PostgresStore } from './store/postgres-store.js'
import { createApiRouter } from './api/routes.js'
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

const app = express()
const httpServer = createServer(app)

app.use(express.json())
app.use(cors({ origin: true }))

// ─── WebSocket proxy (Dashboard ↔ MCP) ──────────────
const proxy = new McpDashboardProxy(httpServer)

// ─── REST API (Dashboard → DB) ──────────────────────
app.use('/api', createApiRouter(store))

app.use('/api', (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API error:', err.message)
  res.status(500).json({ error: err.message })
})

// ─── MCP endpoint (AI Agent → proxy → Dashboard) ────
app.post('/mcp', async (req, res) => {
  const server = new McpServer({ name: 'unity-flux', version: '0.1.0' })
  registerProxyTools(server, proxy)

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => transport.close())
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
})

app.get('/mcp', (_req, res) => {
  res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed. Use POST.' }))
})

app.delete('/mcp', (_req, res) => {
  res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed.' }))
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
