# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Unity Flux is a game data sync platform for delivering over-the-air configuration updates to Unity games. It consists of four components:

- **Management Dashboard**: React app on Vercel for defining data schemas, managing game entries, and publishing config versions
- **Database & Auth**: Supabase (PostgreSQL) for data storage and authentication (Google/Facebook social logins for the Unity client)
- **Content Delivery**: Cloudflare R2 for storing compiled, versioned config files (zero-egress CDN)
- **Unity SDK**: C# package that handles auth, fetches configs from R2, and caches locally with version hash verification

## Architecture

The data flow is: Dashboard (React) -> Supabase (PostgreSQL) -> compiled/published to Cloudflare R2 -> fetched by Unity SDK -> cached on device.

Key concepts:
- **Versioned configs**: Data is compiled and versioned; clients check hashes before downloading
- **Dynamic schemas**: Supports arbitrary game data structures (stats, equipment systems, etc.)
- **Smart caching**: Unity client only downloads when version hash changes

## Tech Stack

- **Frontend**: React, deployed on Vercel
- **Backend**: Supabase (PostgreSQL + Auth)
- **Storage/CDN**: Cloudflare R2
- **Client**: Unity (C#)

## Status

This project is in the planning/documentation phase. No source code has been implemented yet.
