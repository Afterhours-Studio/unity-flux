# Admin Dashboard

The **Flux Dashboard** is the primary interface for game designers and LiveOps managers. It is built using **Next.js** and styled with **Tailwind CSS**.

## 🖥 User Interface Sections

### 1. Schema Builder
A no-code editor for defining data structures.
- **Dynamic Fields**: Supports `string`, `int`, `float`, `bool`, and `color`.
- **Validation Rules**: Constraints such as `min`/`max` values or regex patterns for strings.
- **Live Preview**: View the generated JSON structure as you build the schema.

### 2. Data Editor
A spreadsheet-like interface for managing hundreds of entries efficiently.
- **Bulk Import/Export**: CSV/JSON support for moving data between external tools (like Excel or Google Sheets).
- **Environment Toggling**: Separate views for Development, Staging, and Production data.
- **Dirty State Detection**: Visual indicators for changes that have not yet been published.

### 3. Version History & Publishing
A control center for managing releases.
- **Publish Workflow**: A one-click process that triggers the compilation and upload to Cloudflare R2.
- **Diff Tool**: Compare two versions to see exactly what changed (e.g., "Health increased by 10%").
- **Rollback**: Instant reversion to any previous stable version.

## 🛠 Technical Implementation
- **Framework**: `Next.js` (App Router).
- **State Management**: `React Query` (TanStack Query) for seamless synchronization with Supabase.
- **UI Components**: Custom components built for high-density data management (Glassmorphism design language).
- **Deployment**: Hosted on **Vercel** for optimal global performance and edge middleware support.

## 🛡 Security
- **Middleware**: Next.js middleware handles session validation.
- **Environment Variables**: Sensitive API keys (Supabase Service Role, R2 Credentials) are managed via Vercel Secret Management and never exposed to the client.
