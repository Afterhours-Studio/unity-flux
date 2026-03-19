import { randomUUID } from 'node:crypto'

export function generateId(): string {
  return randomUUID()
}

export function generateProjectId(slug: string): string {
  const suffix = Math.random().toString(36).substring(2, 7)
  return `${slug}-${suffix}`
}

export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'flux_'
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
  return result
}

export function generateAnonKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'anon_'
  for (let i = 0; i < 40; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
  return result
}
