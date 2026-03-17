# Unity Flux: Game Data Sync

## Architecture
* **Management Dashboard:** A React application deployed on Vercel for defining data schemas, managing game entries, and publishing config versions.
* **Database & Auth:** Supabase (PostgreSQL) handles the raw data storage and provides built-in authentication services (Social Logins like Google and Facebook) for the Unity client.
* **Content Delivery:** Cloudflare R2 stores the compiled, versioned configuration files, ensuring high-speed, zero-egress data delivery globally.
* **Unity SDK:** A plug-and-play Unity package that handles user authentication, fetches the latest config files from the R2 CDN, and caches them locally for optimal performance.

## Key Features
* **Instant Over-The-Air Updates:** Publish balancing changes directly to players.
* **Version Control:** Safely maintain, compare, and rollback data versions.
* **Dynamic Data Structures:** Flexible enough to handle any game logic, whether you are balancing core loop variables like Physique, Endurance, and Income, or managing complex logic for a 5-slot equipment system where upgrades require consuming duplicate items.
* **Smart Caching:** The Unity client verifies version hashes and caches data locally to minimize network payload.
* **Cost-Effective Scale:** Combines the generous free tiers of Vercel and Supabase with the zero-egress cost model of Cloudflare R2.

## Tech Stack
* **Frontend:** React, Vercel
* **Backend:** Supabase
* **Storage & CDN:** Cloudflare R2
* **Client Engine:** Unity (C#)
