# 10 — Setup Guide

## Prerequisites
- Node.js 18+ and pnpm
- Docker Desktop (for PostgreSQL)
- Git

## Clone the Repository
```bash
git clone <repo-url>
cd unity-flux
```

## Start the Database
```bash
cd database
docker compose up -d
```
This starts PostgreSQL on port 5432 with credentials `flux:flux_local_dev`.

## Start the API Server
```bash
cd database
pnpm install
pnpm dev
```
Server runs at http://localhost:3001. Endpoints:
- REST API: http://localhost:3001/api
- MCP: http://localhost:3001/mcp
- WebSocket: ws://localhost:3001/ws
- Health: GET http://localhost:3001/api/status

## Start the Dashboard
```bash
cd dashboard
pnpm install
pnpm dev
```
Dashboard runs at http://localhost:5173.

## Create Your First Project
1. Open the dashboard at http://localhost:5173
2. Click "New Project" and enter a name
3. Navigate to the Data tab to create tables
4. Add columns and rows to define your game configuration
5. Go to Versions and click Publish to snapshot your data

## Environment Variables

### Database Server
| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `STORAGE_PROVIDER` | `postgres` | `postgres` or `json` |
| `DATABASE_URL` | `postgresql://flux:flux_local_dev@localhost:5432/unity_flux` | PostgreSQL connection |
| `UNITY_FLUX_DATA_PATH` | `./data/store.json` | JSON store file path |

### Dashboard
Configure in `.env` or `.env.local`:
| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase URL (Phase 2) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (Phase 2) |

## Using JSON Storage (No Docker)
For a lightweight setup without Docker:
```bash
STORAGE_PROVIDER=json pnpm dev
```
Data is stored in `database/data/store.json`.

## Troubleshooting

### Port already in use
```bash
# Check what's using the port
lsof -i :3001
# Or use a different port
PORT=3002 pnpm dev
```

### Database connection failed
- Ensure Docker is running: `docker ps`
- Check PostgreSQL logs: `docker compose logs db`
- Verify credentials in DATABASE_URL

### Dashboard can't reach API
- Ensure the API server is running on port 3001
- Check browser console for CORS errors
- The dashboard expects the API at http://localhost:3001 by default
