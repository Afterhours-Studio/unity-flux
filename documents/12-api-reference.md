# 12 — API Reference

All endpoints are prefixed with `/api` and served from the database server (default `http://localhost:3001`).

## Authentication

All endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <apiKey|anonKey>
```

- `anonKey`: Read-only access (GET requests only). Mutations return `401`.
- `apiKey`: Full access (all methods).

The health check endpoint (`GET /api/status`) is exempt from authentication.

**Error responses:**

| Status | Body | Cause |
|--------|------|-------|
| `401` | `{ "error": "Missing or invalid API key" }` | No token, or token matches no project |
| `401` | `{ "error": "Read-only key cannot perform mutations" }` | `anonKey` used for POST/PATCH/DELETE |

## Rate Limits

All rate limits are per-IP and use the `draft-8` standard headers.

| Tier | Limit | Window | Applies To |
|------|-------|--------|------------|
| General | 100 requests | 15 minutes | All endpoints |
| Mutation | 30 requests | 15 minutes | POST, PATCH, DELETE |
| Publish | 5 requests | 15 minutes | Publish, promote, rollback |

When a rate limit is exceeded the server returns `429` with:

```json
{ "error": "Too many requests, please try again later" }
```

---

## Data Types

### Project

```typescript
{
  id: string
  name: string
  slug: string
  description: string
  apiKey: string
  anonKey: string
  supabaseUrl: string
  r2BucketUrl: string
  environment: "development" | "staging" | "production"
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
}
```

### Schema (Table)

```typescript
{
  id: string
  projectId: string
  name: string
  mode: "data" | "config"
  fields: SchemaField[]
  createdAt: string
  updatedAt: string
}
```

### SchemaField (Column)

```typescript
{
  name: string
  type: "string" | "integer" | "float" | "boolean" | "enum" | "list" | "color" | "config"
  required: boolean
  default?: string | number | boolean
  min?: number
  max?: number
  values?: string[]       // Allowed values for enum type
  configRef?: string      // Referenced config table for config type
}
```

### DataEntry (Row)

```typescript
{
  id: string
  schemaId: string
  data: Record<string, unknown>
  environment: "development" | "staging" | "production"
  isActive: boolean
  createdAt: string
  updatedAt: string
}
```

### Version

```typescript
{
  id: string
  projectId: string
  versionTag: string
  environment: "development" | "staging" | "production"
  status: "active" | "superseded" | "rolled_back"
  data: Record<string, Record<string, unknown>[]>
  tableHashes: Record<string, string>
  tableCount: number
  rowCount: number
  publishedAt: string
}
```

### ActivityLog

```typescript
{
  id: string
  projectId: string
  type: "publish" | "promote" | "rollback"
      | "table_create" | "table_delete" | "table_update"
      | "row_add" | "row_update" | "row_delete"
      | "event_create" | "event_update" | "event_delete"
  message: string
  meta?: Record<string, unknown>
  createdAt: string
}
```

### WebhookRegistration

```typescript
{
  id: string
  projectId: string
  url: string
  secret: string
  events: ActivityLog["type"][]
  active: boolean
  createdAt: string
}
```

### VersionDiff

```typescript
{
  v1Id: string
  v2Id: string
  tableDiffs: VersionTableDiff[]
  summary: {
    tablesAdded: number
    tablesRemoved: number
    tablesModified: number
    totalRowsAdded: number
    totalRowsRemoved: number
    totalRowsModified: number
  }
}
```

### VersionTableDiff

```typescript
{
  tableName: string
  status: "added" | "removed" | "modified" | "unchanged"
  addedRows: Record<string, unknown>[]
  removedRows: Record<string, unknown>[]
  modifiedRows: {
    before: Record<string, unknown>
    after: Record<string, unknown>
    changedFields: string[]
  }[]
  unchangedRowCount: number
}
```

---

## Status

### Health Check

```
GET /api/status
```

Returns server status. **No authentication required.**

**Response** `200`:

```json
{
  "storage": "docker-pg",
  "dashboardConnected": true
}
```

---

## Projects

### List Projects

```
GET /api/projects
```

Returns all projects.

**Response** `200`: `Project[]`

---

### Get Project

```
GET /api/projects/:id
```

Returns a single project.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |

**Response** `200`: `Project`

**Errors:**

| Status | Body |
|--------|------|
| `404` | `{ "error": "Project not found" }` |

---

### Create Project

```
POST /api/projects
```

Creates a new project.

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Project name |
| `description` | string | No | Project description (defaults to `""`) |

**Response** `201`: `Project`

**Errors:**

| Status | Body |
|--------|------|
| `400` | `{ "error": "name is required" }` |

---

### Update Project

```
PATCH /api/projects/:id
```

Updates project fields. Only provided fields are changed.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |

**Body:** Partial `Project` object (any combination of `name`, `description`, `supabaseUrl`, `r2BucketUrl`, `environment`, etc.)

**Response** `200`: `Project`

---

### Delete Project

```
DELETE /api/projects/:id
```

Deletes a project and all associated data.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |

**Response** `200`:

```json
{ "ok": true }
```

---

### Regenerate API Key

```
POST /api/projects/:id/api-key
```

Regenerates the project's API key.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |

**Response** `200`: `Project` (with new `apiKey`)

---

## Tables (Schemas)

### List Tables

```
GET /api/projects/:id/tables
```

Returns all tables belonging to a project.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |

**Response** `200`: `Schema[]`

---

### Get Table

```
GET /api/tables/:id
```

Returns a single table.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Table (schema) ID |

**Response** `200`: `Schema`

**Errors:**

| Status | Body |
|--------|------|
| `404` | `{ "error": "Table not found" }` |

---

### Create Table

```
POST /api/projects/:id/tables
```

Creates a new table in the project.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Table name |
| `fields` | `SchemaField[]` | No | Initial columns (defaults to `[]`) |
| `mode` | `"data" \| "config"` | No | Table mode (defaults to `"data"`) |

**Response** `201`: `Schema`

**Errors:**

| Status | Body |
|--------|------|
| `400` | `{ "error": "name is required" }` |

---

### Update Table

```
PATCH /api/tables/:id
```

Updates a table. Behavior depends on which fields are provided:

- **Rename only**: If only `name` is provided (no `fields`), the table is renamed.
- **Full update**: If `fields` is provided, the full schema is updated.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Table (schema) ID |

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New table name (triggers rename if `fields` absent) |
| `fields` | `SchemaField[]` | No | Updated column definitions |

**Response** `200`: `Schema`

---

### Delete Table

```
DELETE /api/tables/:id
```

Deletes a table and all its rows.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Table (schema) ID |

**Response** `200`:

```json
{ "ok": true }
```

---

## Columns

### Add Column

```
POST /api/tables/:id/columns
```

Adds a column to a table.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Table (schema) ID |

**Body:** `SchemaField`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Column name |
| `type` | string | Yes | Column type (see SchemaField) |
| `required` | boolean | No | Whether the column is required |
| `values` | string[] | No | Allowed values (for `enum` type) |
| `configRef` | string | No | Config table reference (for `config` type) |

**Response** `201`: `Schema` (updated table)

**Errors:**

| Status | Body |
|--------|------|
| `400` | `{ "error": "name and type required" }` |

---

### Update Column

```
PATCH /api/tables/:id/columns/:name
```

Updates an existing column's definition.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Table (schema) ID |
| `name` | string | Column name |

**Body:** Partial `SchemaField` (any combination of `type`, `required`, `values`, `configRef`, etc.)

**Response** `200`: `Schema` (updated table)

---

### Remove Column

```
DELETE /api/tables/:id/columns/:name
```

Removes a column from a table.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Table (schema) ID |
| `name` | string | Column name |

**Response** `200`: `Schema` (updated table)

---

## Rows (Entries)

### List Rows

```
GET /api/tables/:id/rows
```

Returns all rows in a table.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Table (schema) ID |

**Response** `200`: `DataEntry[]`

---

### Get Row

```
GET /api/rows/:id
```

Returns a single row.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Row (entry) ID |

**Response** `200`: `DataEntry`

**Errors:**

| Status | Body |
|--------|------|
| `404` | `{ "error": "Row not found" }` |

---

### Create Row

```
POST /api/tables/:id/rows
```

Creates a new row in a table.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Table (schema) ID |

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | `Record<string, unknown>` | Yes | Row data keyed by column name |
| `environment` | `"development" \| "staging" \| "production"` | No | Target environment (defaults to `"development"`) |

**Response** `201`: `DataEntry`

**Errors:**

| Status | Body |
|--------|------|
| `400` | `{ "error": "data is required" }` |

---

### Update Row

```
PATCH /api/rows/:id
```

Updates a row's data.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Row (entry) ID |

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | `Record<string, unknown>` | Yes | Updated row data |

**Response** `200`: `DataEntry`

**Errors:**

| Status | Body |
|--------|------|
| `400` | `{ "error": "data is required" }` |

---

### Delete Row

```
DELETE /api/rows/:id
```

Deletes a single row.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Row (entry) ID |

**Response** `200`:

```json
{ "ok": true }
```

---

### Bulk Create Rows

```
POST /api/tables/:id/rows/bulk
```

Creates multiple rows at once. Subject to the mutation rate limit.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Table (schema) ID |

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rows` | `Record<string, unknown>[]` | Yes | Array of row data objects |
| `environment` | `"development" \| "staging" \| "production"` | No | Target environment (defaults to `"development"`) |

**Response** `201`: `DataEntry[]`

**Errors:**

| Status | Body |
|--------|------|
| `400` | `{ "error": "rows array is required" }` |

---

### Bulk Delete Rows

```
POST /api/tables/:id/rows/bulk-delete
```

Deletes multiple rows by ID. Subject to the mutation rate limit.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Table (schema) ID |

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ids` | `string[]` | Yes | Array of row IDs to delete |

**Response** `200`:

```json
{ "ok": true, "deleted": 5 }
```

**Errors:**

| Status | Body |
|--------|------|
| `400` | `{ "error": "ids array is required" }` |

---

## Versions

### List Versions

```
GET /api/projects/:id/versions
```

Returns all published versions for a project.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |

**Response** `200`: `Version[]`

---

### Get Active Version Manifest

```
GET /api/projects/:id/versions/active
```

Returns the currently active version for an environment, without the full data payload. Useful for delta sync — the response includes `tableHashes` but omits `data`.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |

**Query:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `env` | string | `"development"` | Environment to query |

**Response** `200`: `Omit<Version, "data">` (Version without the `data` field)

**Errors:**

| Status | Body |
|--------|------|
| `404` | `{ "error": "No active version" }` |

---

### Get Version Table Data

```
GET /api/projects/:id/versions/:vid/tables/:name
```

Returns the data for a single table from a specific version. Used for selective table fetching during delta sync.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |
| `vid` | string | Version ID |
| `name` | string | Table name |

**Response** `200`: `Record<string, unknown>[]` (array of row data)

**Errors:**

| Status | Body |
|--------|------|
| `404` | `{ "error": "Version not found" }` |
| `404` | `{ "error": "Table not found in version" }` |

---

### Publish Version

```
POST /api/projects/:id/publish
```

Publishes a new version snapshot for the specified environment. Subject to the publish rate limit.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `environment` | `"development" \| "staging" \| "production"` | Yes | Target environment |

**Response** `201`: `Version`

**Errors:**

| Status | Body |
|--------|------|
| `400` | `{ "error": "environment is required" }` |

---

### Promote Version

```
POST /api/versions/:id/promote
```

Promotes an existing version to a different environment. Subject to the publish rate limit.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Version ID |

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `targetEnvironment` | `"development" \| "staging" \| "production"` | Yes | Target environment |

**Response** `200`: `Version` (promoted version)

**Errors:**

| Status | Body |
|--------|------|
| `400` | `{ "error": "targetEnvironment is required" }` |

---

### Rollback Version

```
POST /api/versions/:id/rollback
```

Rolls back to a previous version, making it active again. Subject to the publish rate limit.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Version ID to roll back to |

**Response** `200`:

```json
{ "ok": true }
```

---

### Delete Version

```
DELETE /api/versions/:id
```

Permanently deletes a version.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Version ID |

**Response** `200`:

```json
{ "ok": true }
```

---

### Compare Versions

```
POST /api/versions/compare
```

Compares two versions and returns a detailed diff.

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `versionId1` | string | Yes | First version ID |
| `versionId2` | string | Yes | Second version ID |

**Response** `200`: `VersionDiff`

**Errors:**

| Status | Body |
|--------|------|
| `400` | `{ "error": "versionId1 and versionId2 required" }` |

---

## Activity

### List Project Activity

```
GET /api/projects/:id/activity
```

Returns activity logs for a project.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |

**Query:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `limit` | number | (all) | Maximum number of entries to return |

**Response** `200`: `ActivityLog[]`

---

### Recent Activity (All Projects)

```
GET /api/activity/recent
```

Returns the 20 most recent activity entries across all projects. Each entry includes the additional field `projectName`.

**Response** `200`: `(ActivityLog & { projectName: string })[]`

---

## Webhooks

### List Webhooks

```
GET /api/projects/:id/webhooks
```

Returns all webhook registrations for a project.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |

**Response** `200`: `WebhookRegistration[]`

---

### Create Webhook

```
POST /api/projects/:id/webhooks
```

Creates a new webhook registration. Subject to the mutation rate limit.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Webhook endpoint URL |
| `secret` | string | Yes | Shared secret for HMAC signature verification |
| `events` | `ActivityLog["type"][]` | Yes | Array of event types to subscribe to |

**Response** `201`: `WebhookRegistration`

**Errors:**

| Status | Body |
|--------|------|
| `400` | `{ "error": "url, secret, and events[] required" }` |

---

### Delete Webhook

```
DELETE /api/webhooks/:id
```

Deletes a webhook registration.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Webhook ID |

**Response** `200`:

```json
{ "ok": true }
```

---

## Search

### Global Search

```
GET /api/search
```

Searches across projects, tables, and rows. Returns up to 5 matching projects, 10 tables, and 10 rows.

**Query:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | Yes | Search query (case-insensitive) |

**Response** `200`:

```json
{
  "projects": [
    { "id": "...", "name": "...", "slug": "..." }
  ],
  "tables": [
    { "id": "...", "name": "...", "projectId": "...", "projectName": "...", "mode": "data" }
  ],
  "rows": [
    { "id": "...", "schemaId": "...", "tableName": "...", "projectId": "...", "projectName": "...", "preview": "key: value, ..." }
  ]
}
```

Returns empty arrays when `q` is empty or missing.

---

## Codegen

### Generate C# Code

```
GET /api/projects/:id/codegen
```

Generates C# class definitions for all tables in a project. Classes use the `[SerializeField] private` + public getter pattern for Unity compatibility. Config-mode tables extend `FluxConfigTable`.

**Params:**

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Project ID |

**Query:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `namespace` | string | `"GameConfig"` | C# namespace for generated classes |

**Response** `200` (`text/plain`): Generated C# source code.

**Errors:**

| Status | Body |
|--------|------|
| `404` | `{ "error": "No tables found" }` |

**Type mapping:**

| Schema Type | C# Type |
|-------------|---------|
| `string` | `string` |
| `integer` | `int` |
| `float` | `float` |
| `boolean` | `bool` |
| `enum` | `string` |
| `list` | `List<string>` |
| `color` | `Color` |
| `config` | `string` |
