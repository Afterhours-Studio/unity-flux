# Unity Flux - Local Database

Docker PostgreSQL for Phase 1 local development.

## Quick Start

```bash
# Start database
docker compose up -d

# Check status
docker compose ps

# Connect via psql
docker compose exec postgres psql -U flux -d unity_flux

# Stop
docker compose down

# Stop + delete data
docker compose down -v
```

## Connection

```
Host:     localhost
Port:     5432
User:     flux
Password: flux_local_dev
Database: unity_flux
URL:      postgresql://flux:flux_local_dev@localhost:5432/unity_flux
```

## Schema

Tables are auto-created on first start via `init/001-schema.sql`:

- `projects` - Game projects
- `schemas` - Data tables (columns stored as JSONB)
- `entries` - Data rows (values stored as JSONB)
- `versions` - Published version snapshots
- `activities` - Activity log
