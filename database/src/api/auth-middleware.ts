import type { Request, Response, NextFunction } from 'express'
import type { DataStore } from '../store/data-store.js'

export function createAuthMiddleware(store: DataStore) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Skip auth for health check
    if (req.method === 'GET' && req.path === '/status') {
      return next()
    }

    // 2. Extract bearer token from Authorization header
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null

    // 3. No token → 401
    if (!token) {
      return void res.status(401).json({ error: 'Missing or invalid API key' })
    }

    // 4. Check token against all projects' apiKey / anonKey
    const projects = await store.listProjects()

    const apiKeyMatch = projects.some((p) => p.apiKey === token)
    const anonKeyMatch = projects.some((p) => p.anonKey === token)

    if (apiKeyMatch) {
      // 5. Full-access key — allow everything
      return next()
    }

    if (anonKeyMatch) {
      // anonKey only allows read-only (GET) requests
      if (req.method !== 'GET') {
        return void res
          .status(401)
          .json({ error: 'Read-only key cannot perform mutations' })
      }
      return next()
    }

    // 6. No match → 401
    return void res.status(401).json({ error: 'Missing or invalid API key' })
  }
}
