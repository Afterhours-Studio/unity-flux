# 13 — MCP Tools Reference

Unity Flux exposes MCP (Model Context Protocol) tools that AI agents can use to manage game configuration. Tools are accessed via the MCP endpoint at `/mcp`.

## Connection

The MCP endpoint uses HTTP streaming transport:

```
POST http://localhost:3001/mcp
```

Tools execute via a WebSocket proxy: AI agent sends a tool call to the MCP server, which forwards it over WebSocket to the Dashboard (running in the browser with Zustand state), which calls the REST API, which queries the database. Results flow back through the same chain.

```
AI Agent --> MCP Server (/mcp) --> WebSocket --> Dashboard (Zustand) --> REST API (/api) --> Database
```

---

## Projects

### list_projects

List all projects.

**Parameters:** none

**Returns:** Array of projects with id, name, slug, description, environment, keys, and timestamps.

**Example:**

```json
{
  "name": "list_projects",
  "arguments": {}
}
```

---

### get_project

Get a single project by ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | The project ID |

**Returns:** A single project object.

**Example:**

```json
{
  "name": "get_project",
  "arguments": {
    "projectId": "proj_abc123"
  }
}
```

---

### create_project

Create a new project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Yes | Project name |
| `description` | string | No | Project description (defaults to `""`) |

**Returns:** The newly created project object.

**Example:**

```json
{
  "name": "create_project",
  "arguments": {
    "name": "My RPG Game",
    "description": "Configuration for enemy stats, loot tables, and quests"
  }
}
```

---

### update_project

Update a project's properties. Only provided fields are changed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | The project ID |
| `name` | string | No | New project name |
| `description` | string | No | New description |
| `supabaseUrl` | string | No | Supabase URL (Phase 2) |
| `r2BucketUrl` | string | No | R2 bucket URL (Phase 2) |
| `environment` | `"development" \| "staging" \| "production"` | No | Default environment |

**Returns:** The updated project object.

**Example:**

```json
{
  "name": "update_project",
  "arguments": {
    "projectId": "proj_abc123",
    "name": "My RPG Game v2",
    "environment": "staging"
  }
}
```

---

### delete_project

Delete a project and all its data (tables, rows, versions, activity, webhooks).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | The project ID |

**Returns:** Confirmation of deletion.

**Example:**

```json
{
  "name": "delete_project",
  "arguments": {
    "projectId": "proj_abc123"
  }
}
```

---

## Tables

### list_tables

List all tables in a project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | The project ID |

**Returns:** Array of table objects with id, name, mode, fields, and timestamps.

**Example:**

```json
{
  "name": "list_tables",
  "arguments": {
    "projectId": "proj_abc123"
  }
}
```

---

### get_table

Get a single table by ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tableId` | string | Yes | The table ID |

**Returns:** A single table object with full column definitions.

**Example:**

```json
{
  "name": "get_table",
  "arguments": {
    "tableId": "tbl_xyz789"
  }
}
```

---

### create_table

Create a new table in a project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | The project ID |
| `name` | string | Yes | Table name |
| `mode` | `"data" \| "config"` | No | Table mode (defaults to `"data"`) |
| `columns` | array | No | Initial column definitions (defaults to `[]`) |

Each item in the `columns` array has:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Yes | Column name |
| `type` | string | Yes | One of: `string`, `integer`, `float`, `boolean`, `enum`, `list`, `color`, `config` |
| `required` | boolean | No | Whether the column is required (defaults to `false`) |
| `values` | string[] | No | Allowed values (for `enum` type) |
| `configRef` | string | No | Referenced config table (for `config` type) |

**Returns:** The newly created table object.

**Example:**

```json
{
  "name": "create_table",
  "arguments": {
    "projectId": "proj_abc123",
    "name": "enemies",
    "mode": "data",
    "columns": [
      { "name": "name", "type": "string", "required": true },
      { "name": "health", "type": "integer", "required": true },
      { "name": "speed", "type": "float" },
      { "name": "isBoss", "type": "boolean" },
      { "name": "difficulty", "type": "enum", "values": ["easy", "medium", "hard"] }
    ]
  }
}
```

---

### rename_table

Rename an existing table.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tableId` | string | Yes | The table ID |
| `name` | string | Yes | New table name |

**Returns:** The updated table object.

**Example:**

```json
{
  "name": "rename_table",
  "arguments": {
    "tableId": "tbl_xyz789",
    "name": "monsters"
  }
}
```

---

### delete_table

Delete a table and all its rows.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tableId` | string | Yes | The table ID |

**Returns:** Confirmation of deletion.

**Example:**

```json
{
  "name": "delete_table",
  "arguments": {
    "tableId": "tbl_xyz789"
  }
}
```

---

## Columns

### add_column

Add a new column to a table.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tableId` | string | Yes | The table ID |
| `name` | string | Yes | Column name |
| `type` | string | Yes | One of: `string`, `integer`, `float`, `boolean`, `enum`, `list`, `color`, `config` |
| `required` | boolean | No | Whether the column is required (defaults to `false`) |
| `values` | string[] | No | Allowed values (for `enum` type) |
| `configRef` | string | No | Referenced config table (for `config` type) |

**Returns:** The updated table object with the new column.

**Example:**

```json
{
  "name": "add_column",
  "arguments": {
    "tableId": "tbl_xyz789",
    "name": "dropRate",
    "type": "float",
    "required": false
  }
}
```

---

### update_column

Update an existing column's definition.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tableId` | string | Yes | The table ID |
| `columnName` | string | Yes | Current column name |
| `type` | string | No | New column type |
| `required` | boolean | No | Whether the column is required |
| `values` | string[] | No | Updated allowed values (for `enum` type) |
| `configRef` | string | No | Updated config reference (for `config` type) |

**Returns:** The updated table object.

**Example:**

```json
{
  "name": "update_column",
  "arguments": {
    "tableId": "tbl_xyz789",
    "columnName": "difficulty",
    "type": "enum",
    "values": ["easy", "medium", "hard", "nightmare"]
  }
}
```

---

### remove_column

Remove a column from a table.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tableId` | string | Yes | The table ID |
| `columnName` | string | Yes | Column name to remove |

**Returns:** The updated table object without the removed column.

**Example:**

```json
{
  "name": "remove_column",
  "arguments": {
    "tableId": "tbl_xyz789",
    "columnName": "dropRate"
  }
}
```

---

## Rows

### list_rows

List all rows in a table.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tableId` | string | Yes | The table ID |

**Returns:** Array of row objects with id, schemaId, data, environment, and timestamps.

**Example:**

```json
{
  "name": "list_rows",
  "arguments": {
    "tableId": "tbl_xyz789"
  }
}
```

---

### get_row

Get a single row by ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `rowId` | string | Yes | The row ID |

**Returns:** A single row object.

**Example:**

```json
{
  "name": "get_row",
  "arguments": {
    "rowId": "row_def456"
  }
}
```

---

### add_row

Add a new row to a table.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tableId` | string | Yes | The table ID |
| `data` | object | Yes | Row data keyed by column name |
| `environment` | `"development" \| "staging" \| "production"` | No | Target environment (defaults to `"development"`) |

**Returns:** The newly created row object.

**Example:**

```json
{
  "name": "add_row",
  "arguments": {
    "tableId": "tbl_xyz789",
    "data": {
      "name": "Dragon",
      "health": 5000,
      "speed": 2.5,
      "isBoss": true,
      "difficulty": "hard"
    },
    "environment": "development"
  }
}
```

---

### update_row

Update a row's data.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `rowId` | string | Yes | The row ID |
| `data` | object | Yes | Updated row data keyed by column name |

**Returns:** The updated row object.

**Example:**

```json
{
  "name": "update_row",
  "arguments": {
    "rowId": "row_def456",
    "data": {
      "health": 7500,
      "difficulty": "nightmare"
    }
  }
}
```

---

### delete_row

Delete a row.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `rowId` | string | Yes | The row ID |

**Returns:** Confirmation of deletion.

**Example:**

```json
{
  "name": "delete_row",
  "arguments": {
    "rowId": "row_def456"
  }
}
```

---

## Versions

### list_versions

List all published versions for a project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | The project ID |

**Returns:** Array of version objects with id, versionTag, environment, status, tableHashes, tableCount, rowCount, and publishedAt.

**Example:**

```json
{
  "name": "list_versions",
  "arguments": {
    "projectId": "proj_abc123"
  }
}
```

---

### publish_version

Publish a new version snapshot of the current data for a given environment. Any previously active version in the same environment is marked as `superseded`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | The project ID |
| `environment` | `"development" \| "staging" \| "production"` | Yes | Target environment |

**Returns:** The newly published version object.

**Example:**

```json
{
  "name": "publish_version",
  "arguments": {
    "projectId": "proj_abc123",
    "environment": "development"
  }
}
```

---

### promote_version

Promote an existing version to a different environment. Creates a copy of the version data in the target environment.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `versionId` | string | Yes | The version ID to promote |
| `targetEnvironment` | `"development" \| "staging" \| "production"` | Yes | Target environment |

**Returns:** The promoted version object.

**Example:**

```json
{
  "name": "promote_version",
  "arguments": {
    "versionId": "ver_001",
    "targetEnvironment": "staging"
  }
}
```

---

### rollback_version

Rollback to a previous version, making it active again. The currently active version in the same environment is marked as `superseded`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `versionId` | string | Yes | The version ID to roll back to |

**Returns:** Confirmation of rollback.

**Example:**

```json
{
  "name": "rollback_version",
  "arguments": {
    "versionId": "ver_001"
  }
}
```

---

### delete_version

Permanently delete a version.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `versionId` | string | Yes | The version ID |

**Returns:** Confirmation of deletion.

**Example:**

```json
{
  "name": "delete_version",
  "arguments": {
    "versionId": "ver_001"
  }
}
```

---

### compare_versions

Compare two versions and return a detailed diff showing which tables and rows were added, removed, or modified.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `versionId1` | string | Yes | First version ID |
| `versionId2` | string | Yes | Second version ID |

**Returns:** A diff object with per-table breakdowns and a summary of changes.

**Example:**

```json
{
  "name": "compare_versions",
  "arguments": {
    "versionId1": "ver_001",
    "versionId2": "ver_002"
  }
}
```

---

## Activity

### list_activity

List recent activity logs for a project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | The project ID |
| `limit` | number | No | Maximum number of entries to return (defaults to all) |

**Returns:** Array of activity log entries with id, type, message, meta, and createdAt.

**Example:**

```json
{
  "name": "list_activity",
  "arguments": {
    "projectId": "proj_abc123",
    "limit": 10
  }
}
```

---

## Codegen

### generate_csharp_code

Generate C# class definitions for all tables in a project. Classes use the Unity-standard `[SerializeField] private` + public getter pattern. Config-mode tables extend the abstract `FluxConfigTable` base class.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | The project ID |

**Returns:** Generated C# source code as text.

**Example:**

```json
{
  "name": "generate_csharp_code",
  "arguments": {
    "projectId": "proj_abc123"
  }
}
```

**Sample output:**

```csharp
// Auto-generated by Unity Flux
// Do not edit manually.

using System;
using System.Collections.Generic;
using UnityEngine;

namespace GameConfig
{
    [Serializable]
    public class Enemies
    {
        [SerializeField] private string _name;
        public string Name => _name;

        [SerializeField] private int _health;
        public int Health => _health;

        [SerializeField] private float _speed;
        public float Speed => _speed;

        [SerializeField] private bool _isBoss;
        public bool IsBoss => _isBoss;
    }
}
```
