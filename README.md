# Unity Flux: Data Flow UX

Game data sync platform for delivering over-the-air configuration updates to Unity games. Define data tables in a web dashboard, publish versioned configs, and fetch them at runtime through a Unity SDK with offline caching.

## Architecture

```
Dashboard (React / Vercel)
    |
    v
Supabase (PostgreSQL + Auth)        Docker PostgreSQL (local)
    |                                       |
    v                                       v
Cloudflare R2 (CDN)                 Local API Server
    |                                       |
    v                                       v
Unity SDK ------- fetch + cache -------> Game Client
```

Projects can run against a local Docker database or a cloud stack (Supabase + Cloudflare R2). The storage provider is selected per project, so both modes can coexist.

## Features

**Dashboard**

- Table editor with inline editing, drag-and-drop column reordering, type-aware inputs (enum, list, color picker), and data validation (required, min/max, type checks)
- Version management with publish, promote, rollback, and side-by-side diff comparison across development, staging, and production environments
- C# code generation with syntax highlighting, clipboard copy, and .cs file download
- Live Ops event calendar with 8 event templates, recurring events, and battle pass tier management
- Formula designer with expression editor, variable definitions, and preview table
- 7 built-in table templates (Config Parameters, Items, Level Progression, Shop, Loot Table, Enemy Wave, Boss Encounters)
- CSV import and export
- User management with role-based access (admin, editor, viewer)
- Dark and light theme

**MCP Server**

- 25 tools for AI agent integration covering projects, tables, columns, rows, versions, codegen, and activity
- WebSocket proxy relays tool calls from AI agents to the dashboard for human-in-the-loop review
- All tools validated with Zod schemas

**Unity SDK**

- Typed data access: `Flux.GetTable<T>()`, `Flux.Get<T>()`, `Flux.GetOrDefault<T>()`
- Config table support with automatic Parameter/Type/Value detection
- Three-tier cache: memory, disk (`persistentDataPath`), and bundled Resources fallback
- Version hash comparison to skip redundant downloads
- Exponential backoff retry on network requests
- Editor dashboard window with connection testing, table viewer, and manual sync controls

**Infrastructure**

- Supabase Auth with session management and user profiles
- Cloudflare R2 CDN with SHA-256 integrity hashes and cache control
- OAuth 2.1 / PKCE authorization flow for MCP clients
- Vercel serverless API routes for R2 publish, rollback, and OAuth
- Docker Compose for local PostgreSQL with auto-migration
- GitHub Actions CI/CD for Docker image builds to GHCR

## Project Structure

```
unity-flux/
  dashboard/          React app (Vite, React 19, TanStack, shadcn/ui, Tailwind v4)
    api/              Vercel serverless functions (OAuth, R2, MCP)
    src/
      routes/         File-based routing (TanStack Router)
      components/     UI components (shadcn/ui)
      hooks/          TanStack Query hooks
      stores/         Zustand stores (auth, theme, MCP)
      lib/            Supabase client, validation, codegen, templates
  database/           Local API server + MCP proxy
    src/
      api/            REST API routes (Express)
      mcp/            MCP WebSocket proxy + tool registration
      store/          DataStore interface, JsonStore, PostgresStore
      tools/          MCP tool definitions
    init/             PostgreSQL migration scripts
  unity-sdk/          Unity package (com.h1dr0n.unity-flux)
    Runtime/          FluxManager, FluxClient, FluxCache, Flux accessor
    Editor/           Dashboard window, FluxConfig inspector, menu items
  documents/          Architecture documentation (9 documents)
```

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm
- Docker (for local mode)

### Local Development

Start the local database and API server:

```bash
cd database
docker compose up -d
pnpm install
pnpm dev                    # http://localhost:3001
```

Start the dashboard:

```bash
cd dashboard
pnpm install
pnpm dev                    # http://localhost:5173
```

### Cloud Deployment

The dashboard deploys to Vercel. Create a `.env` file from the example:

```bash
cd dashboard
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_URL` | Supabase URL (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `OAUTH_JWT_SECRET` | Secret for signing OAuth JWTs |

R2 CDN variables (set in Vercel dashboard):

| Variable | Description |
|----------|-------------|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_URL` | Public CDN URL for the bucket |

### Unity SDK

Add the package to your Unity project via the Package Manager using the git URL, or copy the `unity-sdk` folder into your project's `Packages` directory.

Requires Unity 2021.3 or later and the Newtonsoft JSON package (`com.unity.nuget.newtonsoft-json`).

Basic usage:

```csharp
// Configure and initialize
FluxManager.Instance.Configure(config);
await FluxManager.Instance.InitializeAsync();

// Access data
var weapons = Flux.GetTable<WeaponData>("weapons");
var maxLevel = Flux.Get<int>("game_settings", "max_level");

// Sync updates
await FluxManager.Instance.SyncAsync();
```

### Docker Image

The database server image is published to GitHub Container Registry on version tags:

```bash
docker pull ghcr.io/<owner>/unity-flux/database:latest
```

To build locally:

```bash
cd database
docker build -t unity-flux-database .
```

## REST API

The local server exposes REST endpoints at `http://localhost:3001/api`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project |
| PATCH | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Delete project |
| GET | `/projects/:id/tables` | List tables |
| POST | `/projects/:id/tables` | Create table |
| GET | `/tables/:id` | Get table |
| PATCH | `/tables/:id` | Update table |
| DELETE | `/tables/:id` | Delete table |
| POST | `/tables/:id/columns` | Add column |
| PATCH | `/tables/:id/columns/:name` | Update column |
| DELETE | `/tables/:id/columns/:name` | Remove column |
| GET | `/tables/:id/rows` | List rows |
| POST | `/tables/:id/rows` | Create row |
| GET | `/rows/:id` | Get row |
| PATCH | `/rows/:id` | Update row |
| DELETE | `/rows/:id` | Delete row |
| GET | `/projects/:id/versions` | List versions |
| POST | `/projects/:id/publish` | Publish version |
| POST | `/versions/:id/promote` | Promote version |
| POST | `/versions/:id/rollback` | Rollback version |
| DELETE | `/versions/:id` | Delete version |
| POST | `/versions/compare` | Compare versions |
| GET | `/projects/:id/activity` | Activity log |
| GET | `/projects/:id/codegen` | Generate C# code |

## MCP Tools

Connect AI agents to the MCP endpoint at `http://localhost:3001/mcp`. Available tools:

| Group | Tools |
|-------|-------|
| Projects | list_projects, get_project, create_project, update_project, delete_project |
| Tables | list_tables, get_table, create_table, rename_table, delete_table |
| Columns | add_column, update_column, remove_column |
| Rows | list_rows, get_row, add_row, update_row, delete_row |
| Versions | list_versions, publish_version, promote_version, rollback_version, delete_version, compare_versions |
| Codegen | generate_csharp_code |
| Activity | list_activity |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 8, TanStack Router + Query, shadcn/ui, Tailwind v4, Zustand |
| Backend | Express 5, MCP SDK, TypeScript |
| Database | PostgreSQL 17 (Docker) / Supabase |
| CDN | Cloudflare R2 |
| Auth | Supabase Auth, OAuth 2.1 / PKCE |
| Hosting | Vercel (dashboard), GHCR (database image) |
| Client | Unity 2021.3+, Newtonsoft.Json |

## License

Polyform Strict License 1.0.0. See [LICENSE.md](LICENSE.md) for details.

Copyright 2026 h1dr0n.
