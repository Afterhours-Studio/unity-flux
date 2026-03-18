import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, Schema, DataEntry } from '@/types/project'

function generateId(): string {
  return crypto.randomUUID()
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'flux_'
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function generateAnonKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'anon_'
  for (let i = 0; i < 40; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

interface ProjectStore {
  projects: Project[]
  schemas: Schema[]
  entries: DataEntry[]

  // Project CRUD
  addProject: (name: string, description: string) => Project
  updateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'supabaseUrl' | 'r2BucketUrl' | 'environment'>>) => void
  deleteProject: (id: string) => void
  getProject: (id: string) => Project | undefined
  regenerateApiKey: (id: string) => void

  // Schema CRUD
  addSchema: (projectId: string, name: string, fields: Schema['fields']) => Schema
  updateSchema: (id: string, updates: Partial<Pick<Schema, 'name' | 'fields'>>) => void
  deleteSchema: (id: string) => void
  getSchemasByProject: (projectId: string) => Schema[]

  // Entry CRUD
  addEntry: (schemaId: string, data: Record<string, unknown>, environment: DataEntry['environment']) => DataEntry
  updateEntry: (id: string, data: Record<string, unknown>) => void
  deleteEntry: (id: string) => void
  getEntriesBySchema: (schemaId: string) => DataEntry[]
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      schemas: [],
      entries: [],

      addProject: (name, description) => {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const now = new Date().toISOString()
        const project: Project = {
          id: generateId(),
          name,
          slug,
          description,
          createdAt: now,
          updatedAt: now,
          apiKey: generateApiKey(),
          anonKey: generateAnonKey(),
          supabaseUrl: '',
          r2BucketUrl: '',
          environment: 'development',
        }
        set((state) => ({ projects: [...state.projects, project] }))
        return project
      },

      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
          ),
        }))
      },

      deleteProject: (id) => {
        set((state) => {
          const schemaIds = state.schemas.filter((s) => s.projectId === id).map((s) => s.id)
          return {
            projects: state.projects.filter((p) => p.id !== id),
            schemas: state.schemas.filter((s) => s.projectId !== id),
            entries: state.entries.filter((e) => !schemaIds.includes(e.schemaId)),
          }
        })
      },

      getProject: (id) => get().projects.find((p) => p.id === id),

      regenerateApiKey: (id) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, apiKey: generateApiKey(), updatedAt: new Date().toISOString() } : p,
          ),
        }))
      },

      addSchema: (projectId, name, fields) => {
        const now = new Date().toISOString()
        const schema: Schema = {
          id: generateId(),
          projectId,
          name,
          fields,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({ schemas: [...state.schemas, schema] }))
        return schema
      },

      updateSchema: (id, updates) => {
        set((state) => ({
          schemas: state.schemas.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s,
          ),
        }))
      },

      deleteSchema: (id) => {
        set((state) => ({
          schemas: state.schemas.filter((s) => s.id !== id),
          entries: state.entries.filter((e) => e.schemaId !== id),
        }))
      },

      getSchemasByProject: (projectId) => get().schemas.filter((s) => s.projectId === projectId),

      addEntry: (schemaId, data, environment) => {
        const now = new Date().toISOString()
        const entry: DataEntry = {
          id: generateId(),
          schemaId,
          data,
          environment,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({ entries: [...state.entries, entry] }))
        return entry
      },

      updateEntry: (id, data) => {
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, data, updatedAt: new Date().toISOString() } : e,
          ),
        }))
      },

      deleteEntry: (id) => {
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        }))
      },

      getEntriesBySchema: (schemaId) => get().entries.filter((e) => e.schemaId === schemaId),
    }),
    {
      name: 'unity-flux-store',
    },
  ),
)
