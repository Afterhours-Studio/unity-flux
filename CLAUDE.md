# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Unity Flux is a game data sync platform for delivering over-the-air configuration updates to Unity games.

## Project Structure

```
unity-flux/
  dashboard/         # React dashboard (Vite 8, React 19, TanStack, shadcn/ui, Tailwind v4)
  database/          # Docker PostgreSQL + REST API + MCP WebSocket proxy
  unity-sdk/         # Unity C# SDK package
  documents/         # Architecture documentation (01-09)
  ROADMAP.md         # Phase 1 (local) + Phase 2 (cloud) development plan
```

## Current Phase: Phase 1 (Local-First)

Focus: Dashboard UI + Unity SDK + Docker PostgreSQL + MCP. No cloud services required.

- **Dashboard**: React app for managing game config tables, publishing versions, generating C# code. MCP tool logic runs here (Zustand state).
- **Database**: Docker PostgreSQL + Express server at `/api` (REST) + `/mcp` (MCP proxy via WebSocket to dashboard)
- **Unity SDK**: C# package (planned) for fetching configs + local caching

Phase 2 will add Supabase + Cloudflare R2 + Vercel deployment. Each project will toggle between local and cloud storage.

## Architecture (Phase 1)

```
Dashboard (React) --> REST API /api --> Local Database
AI Agents         --> MCP /mcp     --> WebSocket --> Dashboard (Zustand) --> REST API --> DB
Unity SDK         --> Config API   --> Local Database
```

## Tech Stack

- **Frontend**: React 19, Vite 8, TanStack Router + Query, shadcn/ui, Tailwind v4, Zustand
- **Backend**: Express, @modelcontextprotocol/sdk, TypeScript
- **Database**: Docker PostgreSQL (Phase 1) / Supabase (Phase 2)
- **CDN**: Local server (Phase 1) / Cloudflare R2 (Phase 2)
- **Client**: Unity (C#)

## Key Commands

```bash
# Dashboard
cd dashboard && pnpm dev         # http://localhost:5173

# Database + API Server
cd database && pnpm dev          # http://localhost:3001
```

## Conventions

- Use pnpm as package manager
- Frontend uses file-based routing (TanStack Router)
- MCP tools use user-facing terminology: "tables" (not schemas), "rows" (not entries), "columns" (not fields)
- C# codegen uses [SerializeField] private + public getter pattern
- Storage layer is pluggable via DataStore interface (per project)
