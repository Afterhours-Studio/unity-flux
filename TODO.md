# Unity Flux — TODO Checklist

## Dashboard

### Hoàn thiện (Done)

- [x] Table editor: CRUD, drag-drop columns, inline editing, type-aware inputs
- [x] Version management: publish, promote, rollback, compare diffs
- [x] C# Codegen: syntax highlighting, download .cs, copy clipboard
- [x] Live Ops: event calendar, battle pass tiers, 8 event templates
- [x] Formulas: expression editor, variable definitions, preview table
- [x] Data Validation: type check, required, min/max, enum, color format
- [x] 7 Table Templates (Config, Items, Level, Shop, Loot, Wave, Boss)
- [x] CSV export
- [x] Auth: login, OAuth callback, set-password flow
- [x] Role-based users: admin, editor, viewer
- [x] Admin page: user management, invite, assign role
- [x] MCP tools: 30+ tools cho AI agent
- [x] State management: Zustand (UI) + TanStack Query (server)
- [x] Project settings: name, description, icon, delete
- [x] CDN endpoint UI: environment selector, copy URL
- [x] Data source toggle: cloud / local / both
- [x] Theme: dark / light / system

### Cần hoàn thiện

- [ ] CSV Import — chỉ có parsing cơ bản, chưa hoàn chỉnh
- [ ] Role-based permission checks — roles tồn tại nhưng chưa enforce granular trên UI
- [ ] Notifications — placeholder "No notifications yet", chưa có logic
- [ ] Bulk row operations — chỉ xoá/edit từng row, chưa có bulk actions
- [ ] Global search — không có tìm kiếm xuyên projects / tables / rows
- [ ] Localization (i18n) — file setup tồn tại, chưa có translations

---

## Database Server

### Hoàn thiện (Done)

- [x] Express server (port 3001) với CORS, error handling
- [x] 27+ REST API endpoints (projects, tables, columns, rows, versions, activity, codegen)
- [x] MCP proxy qua WebSocket với 21 tools + Zod validation
- [x] JsonStore — file-based persistence
- [x] PostgresStore — SQL implementation
- [x] DataStore interface — pluggable storage layer
- [x] 3 database migrations: core schema, live-ops, formulas
- [x] Docker Compose: PostgreSQL 17 + multi-stage Dockerfile
- [x] C# Codegen phía server
- [x] Activity logging cho mọi mutation
- [x] Version snapshot + diff comparison
- [x] Auto version tagging (dev-v0.0.X, staging-v0.0.X, v1.0.X)
- [x] API key generation + regenerate

### Cần hoàn thiện

- [ ] API key authentication — server không validate API key trên REST endpoints
- [ ] Rate limiting — không có bảo vệ khỏi abuse
- [ ] Webhook events — chưa emit events khi data thay đổi

---

## Unity SDK

### Hoàn thiện (Done)

- [x] FluxManager singleton: Configure, Initialize, Sync, ForceRefresh
- [x] FluxConfig ScriptableObject với custom inspector
- [x] Flux static accessor: GetTable\<T\>, Get\<T\>, GetOrDefault\<T\>
- [x] 3-tier cache: Memory → Disk → Resources (offline fallback)
- [x] FluxClient: UnityWebRequest + exponential backoff retry
- [x] Version checking: so sánh tag, skip download nếu chưa đổi
- [x] Config table detection (Parameter / Type / Value)
- [x] Editor Dashboard window: 4 tabs (Status, Config, Tables, Sync)
- [x] Custom FluxConfig inspector với Test Connection
- [x] Cache management (menu + editor window)
- [x] FluxLogger: toggleable, [Flux] prefix
- [x] FluxJson: Newtonsoft.Json wrapper
- [x] State events: OnStateChanged, OnVersionUpdated

### Cần hoàn thiện

- [ ] Example scene / prefab — demo cách sử dụng SDK
- [ ] Unit tests
- [ ] Request timeout configurable
- [ ] Delta sync — hiện luôn download full JSON

---

## Documentation

- [ ] Setup guide — hướng dẫn cài đặt Docker, chạy server, chạy dashboard
- [ ] SDK integration guide — hướng dẫn tích hợp Unity SDK vào game
- [ ] API reference — mô tả các REST endpoints
- [ ] MCP tools reference — mô tả các MCP tools cho AI agent

---

## Phase 2 (Cloud)

### Hoàn thiện (Done)

- [x] Supabase client + supabase-data.ts (798 dòng, full CRUD cho cloud)
- [x] Supabase Auth: login, session, user profiles, avatar upload
- [x] Supabase TypeScript types cho tất cả tables
- [x] Cloudflare R2 CDN: upload, rollback, SHA-256 hash, cache control
- [x] R2 API endpoints: /api/r2/publish, /api/r2/rollback
- [x] Version publish → R2 upload (fire-and-forget), lưu r2_url
- [x] Vercel deployment config + vercel.json rewrites
- [x] 12 serverless API routes (OAuth, R2, MCP, .well-known)
- [x] OAuth 2.1 / PKCE: authorization, token, registration, JWT (HS256)
- [x] OAuth login page cho Supabase auth + callback
- [x] Data source toggle per project: cloud / local / both
- [x] CI/CD: GitHub Actions workflow build Docker image → GHCR
- [x] Unity SDK: CDN URL field trong FluxConfig + Editor UI

### Cần hoàn thiện

- [ ] Supabase Realtime transport cho MCP (hiện vẫn dùng WebSocket)
- [ ] Unity SDK: R2 CDN fetch logic (field có nhưng chưa dùng trong FluxClient)
- [ ] Unity SDK: social auth (Google, Facebook)
- [ ] Supabase RLS policies cho team collaboration
- [ ] Webhook notifications on publish
