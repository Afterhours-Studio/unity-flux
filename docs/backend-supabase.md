# Backend & Database Architecture

Flux utilizes **Supabase** as its core backend provider, leveraging PostgreSQL for relational integrity and built-in Auth for security.

## 🗄 Database Schema Design

The schema is designed to be highly generic, allowing it to support any game genre.

### Core Tables

#### 1. `schemas`
Defines the structure of a data group.
- `id` (UUID): Unique identifier.
- `name` (String): e.g., "LevelConfig", "EnemyStats".
- `definition` (JSONB): Describes the fields (e.g., `{"speed": "float", "health": "int"}`).
- `created_at` (Timestamp).

#### 2. `entries`
The actual data instances.
- `id` (UUID).
- `schema_id` (FK): Reference to the parent schema.
- `data` (JSONB): The actual values (e.g., `{"speed": 5.5, "health": 100}`).
- `environment` (Enum): `dev`, `staging`, or `prod`.

#### 3. `versions`
A history of published snapshots.
- `id` (UUID).
- `hash` (String): Content-based hash.
- `file_url` (String): Pointer to the Cloudflare R2 location.
- `published_by` (FK): User ID of the designer.

## 🔐 Authentication & Security

### Admin Access
- **Provider**: Supabase Auth (Email/Password or SSO).
- **Policy**: Row-Level Security (RLS) ensures that only authorized designers can modify `schemas` and `entries`.

### Client Access (Optional)
- **Player Auth**: The Unity SDK can be configured to use Supabase Auth for players, allowing for player-specific remote overrides (e.g., VIP-only config values).
- **Social Login**: Supported via Google, Apple, and Facebook integrations.

## ⚡ Edge Functions
Custom logic is handled via Supabase Edge Functions (Deno):
- **Compiler**: The function responsible for transforming PostgreSQL rows into the flattened JSON format for distribution.
- **Webhooks**: Can be used to notify Slack/Discord when a new build is published.
