# 04 — Admin Dashboard

> **Document Type:** Feature Specification
> **Audience:** Frontend developers, UI/UX designers, game designers

---

## 4.1 Overview

The **Flux Admin Dashboard** is the primary management interface for game designers and LiveOps teams. It provides a visual, no-code environment for defining data schemas, editing game configurations, and publishing versioned updates to players.

| Aspect           | Detail                                      |
| :--------------- | :------------------------------------------ |
| **Framework**    | React (App Router)                          |
| **Styling**      | Tailwind CSS                                |
| **State Mgmt**   | TanStack Query (React Query)               |
| **Hosting**      | Vercel                                      |
| **Design System**| Custom high-density UI (glassmorphism)      |

---

## 4.2 Information Architecture

```
Dashboard
├── Authentication
│   └── Login / SSO
├── Project Selector
│   └── Create / Switch projects
├── Schema Builder
│   ├── Field Editor
│   ├── Validation Rules
│   └── Live JSON Preview
├── Data Editor
│   ├── Table View (spreadsheet-style)
│   ├── Bulk Import / Export
│   └── Environment Switcher
├── Version Manager
│   ├── Publish Workflow
│   ├── Version History
│   ├── Diff Viewer
│   └── Rollback Controls
└── Settings
    ├── Team Management
    ├── API Keys
    └── Webhook Configuration
```

---

## 4.3 Core Features

### 4.3.1 Schema Builder

A visual, no-code editor for defining the structure of game data.

**Supported Field Types:**

| Type      | Description                  | Example Value         |
| :-------- | :--------------------------- | :-------------------- |
| `string`  | Text value                   | `"Fire Sword"`        |
| `integer` | Whole number                 | `150`                 |
| `float`   | Decimal number               | `3.14`                |
| `boolean` | True/false flag              | `true`                |
| `enum`    | Predefined set of values     | `"fire" \| "water"`   |
| `color`   | Hex color code               | `"#FF5733"`           |

**Validation Rules:**
- Numeric fields: `min`, `max`, `step`
- String fields: `regex`, `maxLength`
- All fields: `required`, `default`

**Live Preview:** The right panel displays the generated JSON structure in real time as the designer builds the schema.

### 4.3.2 Data Editor

A spreadsheet-style interface optimized for managing large volumes of game entries.

**Capabilities:**
- **Inline Editing** — Click any cell to modify values with type-appropriate input controls.
- **Bulk Import / Export** — CSV and JSON file support for integration with Excel, Google Sheets, or external tools.
- **Environment Toggling** — Tabs for `Development`, `Staging`, and `Production` with isolated data views.
- **Dirty State Indicators** — Visual markers highlight cells that have been modified but not yet published.
- **Search & Filter** — Full-text search across entries with column-based filtering.

### 4.3.3 Version Manager

A control center for managing the publish lifecycle.

| Feature              | Description                                                       |
| :------------------- | :---------------------------------------------------------------- |
| **Publish Workflow**  | One-click compilation + upload to R2. Includes dry-run validation.|
| **Version History**   | Chronological list of all published versions with metadata.       |
| **Diff Viewer**       | Side-by-side comparison of any two versions showing exact changes.|
| **Rollback**          | One-click reversion to any previous version (re-publishes it).    |
| **Environment Scope** | Publish independently per environment.                            |

---

## 4.4 User Roles & Permissions

| Role      | Schemas          | Entries              | Publish           | Settings          |
| :-------- | :--------------- | :------------------- | :---------------- | :---------------- |
| Admin     | Create, Edit, Delete | Full CRUD         | Yes               | Full access       |
| Editor    | View only        | Create, Edit         | No                | View only         |
| Viewer    | View only        | View only            | No                | No access         |

---

## 4.5 Technical Implementation

### State Management

```
TanStack Query (React Query)
├── Queries: Supabase real-time subscriptions for live data sync
├── Mutations: Optimistic updates with rollback on error
└── Cache: Stale-while-revalidate strategy for responsive UI
```

### Key Libraries

| Library                | Purpose                                    |
| :--------------------- | :----------------------------------------- |
| `@supabase/supabase-js`| Database client and auth                  |
| `@tanstack/react-query`| Server state management                   |
| `tailwindcss`          | Utility-first styling                      |
| `react-hot-toast`      | User notifications                         |
| `date-fns`             | Date formatting and comparison             |

### Security

- **Session Management** — Handled by Next.js middleware; validates Supabase JWT on every request.
- **Environment Variables** — Sensitive keys (Supabase Service Role, R2 credentials) are stored in Vercel Secret Management and never exposed to the client bundle.
- **CSRF Protection** — Enabled via Vercel's built-in middleware.

---

## 4.6 UI Wireframe (Conceptual)

```
┌─────────────────────────────────────────────────────────┐
│  ☰  Unity Flux          [Project: Idle Heroes ▼]  [👤]  │
├──────────┬──────────────────────────────────────────────┤
│          │  Schema: EnemyStats                          │
│ Schemas  │  ┌─────────┬──────┬──────┬────────┐         │
│ ───────  │  │ Name    │ Type │ Min  │ Max    │         │
│ > Enemy  │  ├─────────┼──────┼──────┼────────┤         │
│   Stats  │  │ health  │ int  │ 1    │ 99999  │         │
│   Level  │  │ speed   │ float│ 0.1  │ 100.0  │         │
│   Config │  │ element │ enum │ —    │ —      │         │
│   Items  │  │ is_boss │ bool │ —    │ —      │         │
│          │  └─────────┴──────┴──────┴────────┘         │
│          │                                              │
│ Versions │  [+ Add Field]                               │
│ Settings │                                              │
│          │  ┌─ Live Preview ──────────────────┐         │
│          │  │ { "health": 100, "speed": 5.5,  │         │
│          │  │   "element": "fire",             │         │
│          │  │   "is_boss": false }             │         │
│          │  └─────────────────────────────────┘         │
├──────────┴──────────────────────────────────────────────┤
│  [Dev] [Staging] [Production]     [Publish v1.2.5 ▶]   │
└─────────────────────────────────────────────────────────┘
```

---

**Previous:** [03 — Database Design](03-database-design.md)
**Next:** [05 — Content Delivery](05-content-delivery.md)
