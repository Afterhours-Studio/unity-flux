# Unity Flux - Roadmap

## Overview

Unity Flux is a game data sync platform. Development is split into 2 phases: **Local-First** (no cloud dependency) and **Cloud Deployment** (Supabase + R2).

Each project supports a **storage toggle** — choose local or cloud per project. This allows gradual migration without breaking existing workflows.

---

## Phase 1: Local-First (Current)

> Dashboard UI + Unity SDK + Docker PostgreSQL + MCP Server

### Goals
- Fully functional dashboard for managing game configs
- Unity SDK that fetches configs from a local server
- Docker-based local database (PostgreSQL) — no cloud account needed
- MCP server for AI agent integration
- Prepare pluggable storage layer for Phase 2

### Architecture

```
+---------------------------+                  +-----------------+
|   Dashboard (React)       |                  |   Unity SDK     |
|   + MCP tool executors    |                  |   (C#)          |
+--------+--------+--------+                  +--------+--------+
         |        ^                                    |
         |        | WebSocket                          |
         v        v                                    v
+-------------------------------------------+  +------------------+
|   Database Server (Docker)                |  | Config API       |
|   REST API /api  +  MCP proxy /mcp  + WS  |  | /config/*        |
+--------+----------------------------------+  +--------+---------+
         |                                             |
         v                                             v
+-------------------+                         +-----------------+
| Docker PostgreSQL |                         | Local File      |
| (port 5432)       |                         | Server          |
+-------------------+                         +-----------------+

Flow:
  User edits     → Dashboard Zustand → Save → REST API → DB
  AI Agent       → POST /mcp → WS proxy → Dashboard Zustand (draft)
                   User reviews → Save → REST API → DB
```

### Components

| Component | Description | Status |
|-----------|-------------|--------|
| Dashboard | React + Vite + TanStack + shadcn/ui + MCP tools | In progress |
| Database Server | Express + REST API + MCP WebSocket proxy | In progress |
| Docker DB | PostgreSQL via Docker Compose | Done |
| Unity SDK | C# package, local server fetch | Planned |
| Data Validation | Type check, range, pre-publish gate | Done |
| Table Templates | 9 built-in templates | Done |
| Codegen | Auto-generate C# classes from schemas | Done |
| CSV Import/Export | Bulk data operations | Done |

### Dashboard Features (Phase 1)

- **Overview** — Project credentials, SDK integration, activity timeline
- **Data** — Table editor with config/data modes, inline enum/list, color picker
- **Versions** — Publish, promote, rollback, compare diffs
- **Codegen** — Generate C# classes with [SerializeField] pattern
- **Settings** — Project config, delete project
- **Storage toggle** — Local (default) / Cloud (disabled until Phase 2)

### Storage Toggle (per project)

```
Project Settings > Storage Provider

  [*] Local Database
      Docker PostgreSQL on localhost:5432
      Data stays on your machine
      Good for: development, prototyping, solo dev

  [ ] Cloud (Phase 2)
      Supabase (PostgreSQL) + Cloudflare R2
      Data synced to cloud, CDN delivery
      Good for: production, team collaboration, live games
```

### MCP Tools (25 total)

| Group | Tools | Description |
|-------|-------|-------------|
| Projects | 5 | list, get, create, update, delete |
| Tables | 5 | list, get, create, rename, delete |
| Columns | 3 | add, update, remove |
| Rows | 5 | list, get, add, update, delete |
| Versions | 6 | list, publish, promote, rollback, delete, compare |
| Codegen | 1 | generate C# classes |
| Activity | 1 | list recent activity |

### Tech Stack (Phase 1)

| Layer | Technology |
|-------|-----------|
| Dashboard | React 19, Vite 8, TanStack Router/Query, shadcn/ui, Tailwind v4 |
| Backend | Express, MCP SDK, TypeScript |
| Database | Docker PostgreSQL |
| State | React Query (server state) + Zustand (UI state) |
| Unity SDK | C# (.NET Standard 2.1) |

### Deliverables
- [ ] Docker Compose for local PostgreSQL
- [ ] MCP server connected to PostgreSQL (replace JSON file)
- [ ] REST API for dashboard
- [ ] Dashboard fully wired to REST API
- [ ] Unity SDK: auth, config fetch, local cache, version hash check
- [ ] Storage provider toggle in project settings (UI ready, cloud disabled)
- [ ] Documentation: setup guide, SDK integration guide

---

## Phase 2: Cloud Deployment

> Supabase + Cloudflare R2 + Vercel + Social Auth

### Goals
- Projects can opt-in to cloud storage (Supabase + R2)
- Dashboard deployed on Vercel
- Unity clients authenticate via Supabase Auth (Google, Facebook)
- Compiled configs published to Cloudflare R2 CDN
- Zero-egress global delivery

### Architecture

```
+-----------------+     +-----------------+     +-----------------+
|   Dashboard     |     |   MCP Server    |     |   Unity SDK     |
|   (Vercel)      |     |   (Cloud Run)   |     |   (C#)          |
+--------+--------+     +--------+--------+     +--------+--------+
         |                       |                       |
         v                       v                       |
+-------------------+   +-------------------+            |
|  Supabase         |   |  Supabase         |            |
|  PostgreSQL       |   |  PostgreSQL       |            |
|  + Auth           |   |                   |            |
+--------+----------+   +-------------------+            |
         |                                               |
         v                                               v
+-------------------+                          +-------------------+
|  Compile &        |                          |  Cloudflare R2    |
|  Publish to R2    | -----------------------> |  (CDN)            |
+-------------------+                          +--------+----------+
                                                        |
                                                        v
                                               +-------------------+
                                               |  Unity Client     |
                                               |  Local Cache      |
                                               +-------------------+
```

### What Changes from Phase 1

| Aspect | Phase 1 (Local) | Phase 2 (Cloud) |
|--------|----------------|-----------------|
| Database | Docker PostgreSQL | Supabase PostgreSQL |
| Auth | Local accounts | Supabase Auth (Google, Facebook) |
| Config delivery | Local server | Cloudflare R2 CDN |
| Dashboard host | localhost | Vercel |
| MCP transport | WebSocket (localhost) | Supabase Realtime channels |
| MCP endpoint | Docker server `/mcp` | Vercel API route `/api/mcp` |
| Cost | Free (local) | Free tier (Supabase + R2 + Vercel) |

### MCP in Phase 2 (Cloud)

Phase 1: MCP tool calls go through a WebSocket proxy on the local Docker server.
Phase 2: No dedicated server needed. MCP uses **Supabase Realtime** as transport:

```
AI Agent → POST /api/mcp (Vercel API route)
                ↓
         Supabase Realtime channel (publish tool_call)
                ↓
         Dashboard (subscribed) executes tool in Zustand state
                ↓
         Supabase Realtime channel (publish tool_response)
                ↓
         Vercel API route returns response to AI Agent
```

- Dashboard MCP client code stays the same — only swap transport (WebSocket → Supabase Realtime)
- Vercel API route is a thin serverless proxy (~50 lines)
- No dedicated backend server needed for MCP in cloud mode

### New Features (Phase 2 only)
- Supabase Auth integration (social logins for Unity clients)
- Compile & publish pipeline (dashboard -> Supabase -> R2)
- Version hash verification on R2
- Global CDN delivery with zero egress costs
- Team collaboration (Supabase RLS for permissions)
- Webhook notifications on publish
- MCP via Supabase Realtime (no dedicated server)

### Deliverables
- [ ] Supabase project setup + schema migration
- [ ] SupabaseStore implementation (pluggable, replaces DockerStore)
- [ ] Cloudflare R2 integration (compile + upload)
- [ ] Supabase Auth (Google, Facebook social login)
- [ ] Vercel deployment config + API route for MCP proxy
- [ ] Supabase Realtime transport for MCP (replace WebSocket)
- [ ] Unity SDK: R2 fetch, hash verification, social auth
- [ ] Storage toggle: enable "Cloud" option per project
- [ ] CI/CD pipeline for dashboard

---

## Storage Provider Interface

Both phases share the same `DataStore` interface. The storage provider is selected per project.

```typescript
interface DataStore {
  // Projects
  listProjects(): Promise<Project[]>
  getProject(id: string): Promise<Project | null>
  createProject(name: string, description: string): Promise<Project>
  updateProject(id: string, updates: Partial<Project>): Promise<Project>
  deleteProject(id: string): Promise<void>

  // Tables, Columns, Rows, Versions, Activity...
  // (same interface for all providers)
}

// Phase 1
class PostgresStore implements DataStore { ... }

// Phase 2
class SupabaseStore implements DataStore { ... }
```

Switching providers is transparent — dashboard and MCP tools don't change.
