# Flux: Game Data Sync

## Overview

**Flux** is a self-hosted, lightweight LiveOps and Remote Config synchronization framework built for Unity. It empowers game designers to instantly deploy data updates, balance core mechanics, and manage game states globally without the need for client-side app store updates.

By leveraging a modern Serverless and BaaS (Backend-as-a-Service) stack, Flux achieves high scalability and zero-egress content delivery at near-zero maintenance costs.

---

## 🏗 System Architecture

The ecosystem is divided into four main pillars, ensuring a strict separation of concerns between data management, storage, and client consumption.

| Component                  | Technology                             | Responsibility                                                                                                                                                             |
| :------------------------- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin Dashboard**        | **React / Next.js (Hosted on Vercel)** | The visual control panel. Used for creating schemas, modifying game data, and publishing versioned config updates.                                                         |
| **Core Backend & Auth**    | **Supabase (PostgreSQL)**              | The "Single Source of Truth". Stores raw configuration data, handles user/player accounts, and manages Social Login (Google, Facebook) integrations via its Auth API.      |
| **Content Delivery (CDN)** | **Cloudflare R2**                      | The distribution hub. Stores compiled, read-only `.json` configuration files published from the dashboard. Provides global, high-speed delivery with **zero egress fees**. |
| **Game Client**            | **Unity (C# Package)**                 | The consumer. Authenticates players, fetches the latest config hashes from R2, downloads new data only when necessary, and parses it into usable game logic.               |

---

## 🔄 Data Flow (How It Works)

1. **Design & Edit:** The designer uses the Vercel-hosted React Dashboard to adjust game metrics. Data is saved directly to Supabase's PostgreSQL database.
2. **Publish & Compile:** Once changes are finalized, the designer clicks "Publish". The backend queries Supabase, compiles the raw data into optimized, versioned static files (e.g., `v1.0.5.json`), and uploads them to Cloudflare R2.
3. **Client Fetch:** When a player opens the Unity game, the Flux Unity SDK pings a lightweight endpoint to check the latest version hash.
4. **Smart Cache & Apply:** If the hash differs from the local cache, the client downloads the new JSON from the R2 CDN, updates the local PlayerPrefs/cache, and injects the new data into the game session.

---

## 🎯 Practical Use Cases

Flux's dynamic schema allows for the flexible management of complex game systems:

- **Idle Game Balancing:** Adjust multiplier coefficients for core progression stats like **Physique**, **Endurance**, and **Income** in real-time to maintain economic stability.
- **RPG Equipment & Meta Management:** Define and update schemas for complex loadouts, such as enforcing a strict **5-slot equipment system** (1 Weapon, 1 Armor, 1 Boots, 2 Accessories) and dynamically tweaking the consumption requirements for duplicate-based equipment upgrades.
- **A/B Testing & Events:** Roll out temporary configurations for holiday events or test new drop rates without patching the game.

---

## 🚀 Key Advantages

- **Zero Egress Costs:** By serving data through Cloudflare R2 instead of direct database queries, bandwidth costs are effectively eliminated.
- **High Performance:** Database load is minimized. Millions of concurrent players simply fetch a static file from the edge CDN.
- **Seamless Player Experience:** Built-in support for linked accounts ensures progression and data are tied to the player, not the device.
- **Developer Friendly:** Designed as an isolated Unity Package (`unity-flux`), making it highly reusable across multiple future titles.
