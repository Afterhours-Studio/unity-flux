# Unity Flux — Technical Documentation

> **Version:** 0.1.0 (Pre-release)
> **Last Updated:** 2026-03-18
> **Status:** Planning & Design Phase

## About This Documentation

This directory contains the complete technical documentation for **Unity Flux** — a game data synchronization platform that delivers over-the-air configuration updates to Unity games. The documentation is organized by domain and follows a logical reading order from high-level concepts to implementation details.

---

## Table of Contents

| #  | Document                                              | Description                                                    |
| :- | :---------------------------------------------------- | :------------------------------------------------------------- |
| 01 | [Project Overview](01-project-overview.md)            | Vision, goals, scope, and target audience                      |
| 02 | [System Architecture](02-system-architecture.md)      | High-level architecture, component map, and design principles  |
| 03 | [Database Design](03-database-design.md)              | Supabase PostgreSQL schema, RLS policies, and Edge Functions   |
| 04 | [Admin Dashboard](04-admin-dashboard.md)              | React management interface — features and technical design     |
| 05 | [Content Delivery](05-content-delivery.md)            | Cloudflare R2 storage strategy, caching, and file conventions  |
| 06 | [Unity SDK](06-unity-sdk.md)                          | C# client package — API reference, caching, and integration   |
| 07 | [Data Flow & Lifecycle](07-data-flow.md)              | End-to-end journey of a configuration update                   |
| 08 | [Security Model](08-security.md)                      | Authentication, authorization, data integrity, and threat model|
| 09 | [Deployment & Operations](09-deployment.md)           | Infrastructure setup, CI/CD, monitoring, and cost analysis     |

---

## Reading Guide

- **New to the project?** Start with [01 — Project Overview](01-project-overview.md), then [02 — System Architecture](02-system-architecture.md).
- **Backend / DevOps engineer?** Focus on [03](03-database-design.md), [05](05-content-delivery.md), [08](08-security.md), and [09](09-deployment.md).
- **Frontend developer?** See [04 — Admin Dashboard](04-admin-dashboard.md) and [07 — Data Flow](07-data-flow.md).
- **Unity / Game developer?** Jump to [06 — Unity SDK](06-unity-sdk.md) and [07 — Data Flow](07-data-flow.md).

## Conventions

- **Diagrams** use [Mermaid.js](https://mermaid.js.org/) syntax and render natively on GitHub / GitLab.
- **Code examples** are illustrative and may not compile directly until the implementation phase begins.
- **Environment references** follow the convention: `development` → `staging` → `production`.
