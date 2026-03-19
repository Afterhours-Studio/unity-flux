import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { JsonStore } from './store/json-store.js'
import { registerProjectTools } from './tools/projects.js'
import { registerTableTools } from './tools/tables.js'
import { registerColumnTools } from './tools/columns.js'
import { registerRowTools } from './tools/rows.js'
import { registerVersionTools } from './tools/versions.js'
import { registerCodegenTools } from './tools/codegen.js'
import { registerActivityTools } from './tools/activity.js'
import { resolve } from 'node:path'

const DATA_PATH = process.env.UNITY_FLUX_DATA_PATH || resolve(import.meta.dirname, '../data/store.json')
const PORT = parseInt(process.env.PORT || '3001', 10)

const store = new JsonStore(DATA_PATH)
const app = express()

app.use(express.json())

app.post('/mcp', async (req, res) => {
  const server = new McpServer({ name: 'unity-flux', version: '0.1.0' })
  registerProjectTools(server, store)
  registerTableTools(server, store)
  registerColumnTools(server, store)
  registerRowTools(server, store)
  registerVersionTools(server, store)
  registerCodegenTools(server, store)
  registerActivityTools(server, store)

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => {
    transport.close()
  })
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
})

app.get('/mcp', async (_req, res) => {
  res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed. Use POST.' }))
})

app.delete('/mcp', async (_req, res) => {
  res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed.' }))
})

app.listen(PORT, () => {
  console.log(`Unity Flux MCP server running at http://localhost:${PORT}/mcp`)
})
