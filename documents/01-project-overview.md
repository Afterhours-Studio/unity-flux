# 01 — Project Overview

> **Document Type:** Introduction
> **Audience:** All stakeholders (developers, designers, managers)

---

## 1.1 What is Unity Flux?

**Unity Flux** is a self-hosted, lightweight LiveOps and Remote Configuration platform built specifically for Unity games. It enables game designers to push data updates — balance changes, event configurations, feature flags — directly to players without requiring app store submissions or client patches.

The platform follows a **"Write Once, Deliver Everywhere"** philosophy: data is authored once through a web dashboard, compiled into optimized static files, and distributed globally through edge CDN infrastructure.

---

## 1.2 Problem Statement

Mobile and live-service games face a recurring challenge:

| Problem                          | Impact                                                        |
| :------------------------------- | :------------------------------------------------------------ |
| Slow update cycles               | Balance fixes require full app store review (24–72 hours)     |
| High bandwidth costs             | Direct database queries at scale generate significant egress  |
| Fragile data pipelines           | Manual JSON editing is error-prone and unversioned            |
| No rollback capability           | Bad configurations can break the game with no quick recovery  |
| Expensive commercial solutions   | Enterprise LiveOps platforms (PlayFab, GameSparks) are costly |

Unity Flux solves these problems with a purpose-built, cost-effective stack.

---

## 1.3 Goals & Objectives

### Primary Goals

1. **Instant Over-The-Air Updates** — Publish configuration changes that reach players within minutes, not days.
2. **Zero-Egress Distribution** — Serve all player traffic through Cloudflare R2, eliminating bandwidth costs entirely.
3. **Schema-Driven Flexibility** — Support arbitrary data structures so the platform works for any game genre (idle, RPG, puzzle, etc.).
4. **Version Safety** — Every publish creates an immutable snapshot with full rollback capability.

### Secondary Goals

5. **Offline Resilience** — Games remain fully playable using cached configurations when the network is unavailable.
6. **Developer Portability** — The Unity SDK is an isolated package, reusable across multiple game titles.
7. **Low Operational Cost** — Leverage free/low-cost tiers of Vercel, Supabase, and Cloudflare R2.

---

## 1.4 Target Audience

| Role              | How They Use Flux                                                  |
| :---------------- | :----------------------------------------------------------------- |
| Game Designer      | Authors schemas and data entries through the Admin Dashboard       |
| LiveOps Manager    | Publishes versions, monitors rollouts, triggers rollbacks          |
| Unity Developer    | Integrates the SDK, consumes typed config data in game code        |
| Backend Engineer   | Manages Supabase schema, Edge Functions, and R2 bucket policies    |

---

## 1.5 Scope

### In Scope (v1.0)

- Web-based admin dashboard for schema and data management
- Supabase backend with PostgreSQL storage and authentication
- Cloudflare R2 storage with versioned config publishing
- Unity C# SDK with authentication, sync, and local caching
- Environment support: `development`, `staging`, `production`
- Version history with diff comparison and one-click rollback

### Out of Scope (v1.0)

- Real-time push notifications (WebSocket-based live updates)
- A/B testing with player segmentation (planned for v2.0)
- Binary asset delivery (textures, audio — Flux handles JSON data only)
- Analytics and telemetry dashboards

---

## 1.6 Use Cases

### Use Case 1 — Idle Game Balancing

A designer adjusts multiplier coefficients for core progression stats (Physique, Endurance, Income). Changes are published and take effect for all players within minutes, maintaining economic stability without a client update.

### Use Case 2 — RPG Equipment System

The platform manages a 5-slot equipment system (1 Weapon, 1 Armor, 1 Boots, 2 Accessories) where upgrade requirements (duplicate item consumption) are defined as remote config. Designers can tweak upgrade curves without developer involvement.

### Use Case 3 — Seasonal Events

Temporary event configurations (holiday themes, limited-time drop rates) are published with scheduled start/end dates. After the event, the designer rolls back to the baseline config.

---

## 1.7 Tech Stack Summary

| Layer            | Technology           | Purpose                                  |
| :--------------- | :------------------- | :--------------------------------------- |
| Frontend         | React + Vercel       | Admin dashboard hosting                  |
| Backend          | Supabase (PostgreSQL)| Data storage, authentication, Edge Funcs |
| CDN / Storage    | Cloudflare R2        | Static config file distribution          |
| Game Client      | Unity (C#)           | Config consumption, caching, auth        |

---

**Next:** [02 — System Architecture](02-system-architecture.md)
