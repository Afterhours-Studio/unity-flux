# 09 — Deployment & Operations

> **Document Type:** Operations Guide
> **Audience:** DevOps engineers, backend developers, project leads

---

## 9.1 Overview

Unity Flux leverages fully managed, serverless infrastructure — minimizing operational overhead while maximizing scalability. There are no servers to provision, patch, or scale manually.

### Infrastructure Summary

| Component        | Service          | Tier            | Scaling Model        |
| :--------------- | :--------------- | :-------------- | :------------------- |
| Dashboard        | Vercel           | Free / Pro      | Auto-scaling (edge)  |
| Database + Auth  | Supabase         | Free / Pro      | Managed PostgreSQL   |
| CDN / Storage    | Cloudflare R2    | Free (10 GB)    | Unlimited edge nodes |
| DNS + Security   | Cloudflare       | Free            | Global Anycast       |

---

## 9.2 Environment Strategy

Three environments maintain strict isolation throughout the pipeline:

| Environment   | Purpose                              | Dashboard URL                     | R2 Path               |
| :------------ | :----------------------------------- | :-------------------------------- | :--------------------- |
| Development   | Active development and testing       | `dev.flux.yourstudio.com`         | `/{project}/development/` |
| Staging       | Pre-release validation               | `staging.flux.yourstudio.com`     | `/{project}/staging/`    |
| Production    | Live player-facing configuration     | `flux.yourstudio.com`             | `/{project}/production/` |

### Promotion Flow

```
Development  ──(manual publish)──▶  Staging  ──(manual publish)──▶  Production
```

Each environment has:
- Its own set of entries in Supabase (filtered by `environment` column)
- Its own version history and `master_version.json` pointer on R2
- Independent publish and rollback controls

---

## 9.3 Initial Setup Checklist

### Step 1 — Supabase

- [ ] Create a new Supabase project
- [ ] Run the database migration script to create tables (`schemas`, `entries`, `versions`, `version_entries`)
- [ ] Enable Row-Level Security on all tables
- [ ] Apply RLS policies (see [03 — Database Design](03-database-design.md))
- [ ] Configure auth providers (email, Google, Facebook, Apple)
- [ ] Deploy Edge Functions (`compile-and-publish`, `notify-webhook`)

### Step 2 — Cloudflare R2

- [ ] Create an R2 bucket (e.g., `flux-configs`)
- [ ] Configure a custom domain (e.g., `flux-cdn.yourstudio.com`)
- [ ] Set up CORS policy for Unity WebGL builds (if applicable)
- [ ] Generate R2 API tokens for write access
- [ ] Configure cache rules (short TTL for `master_version.json`, immutable for config files)

### Step 3 — Vercel

- [ ] Create a new Vercel project linked to the dashboard repository
- [ ] Configure environment variables:

| Variable                    | Value                              |
| :-------------------------- | :--------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`  | `https://{project}.supabase.co`   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key        |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key          |
| `R2_ACCOUNT_ID`             | Cloudflare account ID              |
| `R2_ACCESS_KEY_ID`          | R2 API access key                  |
| `R2_SECRET_ACCESS_KEY`      | R2 API secret key                  |
| `R2_BUCKET_NAME`            | `flux-configs`                     |
| `R2_PUBLIC_URL`             | `https://flux-cdn.yourstudio.com` |

- [ ] Configure preview deployment settings (team-only access)
- [ ] Set up custom domain

### Step 4 — Unity SDK

- [ ] Add the Flux SDK package via UPM
- [ ] Configure `FluxConfig` ScriptableObject with:
  - Project slug
  - Environment (dev/staging/prod)
  - CDN base URL
- [ ] Bundle default config in `Assets/Resources/FluxDefaults/`
- [ ] Test sync flow in Editor

---

## 9.4 CI/CD Pipeline

### Dashboard (Vercel)

Vercel provides a built-in CI/CD pipeline:

```
git push to main  →  Vercel Build  →  Preview Deploy  →  Production Deploy
                     (auto)           (PR preview)       (merge to main)
```

| Event              | Action                                            |
| :----------------- | :------------------------------------------------ |
| Push to branch     | Preview deployment created automatically          |
| Merge to `main`    | Production deployment triggered                   |
| Build failure      | Deployment blocked, notification sent              |

### Edge Functions (Supabase)

```
git push to main  →  supabase functions deploy  →  Live on Supabase Edge
```

Deploy via Supabase CLI:
```bash
supabase functions deploy compile-and-publish
supabase functions deploy notify-webhook
```

### Database Migrations

```bash
# Generate migration from schema changes
supabase db diff -f migration_name

# Apply migration
supabase db push

# Reset (development only)
supabase db reset
```

---

## 9.5 Monitoring & Observability

### Health Checks

| Check                        | Method                                   | Frequency | Alert Threshold    |
| :--------------------------- | :--------------------------------------- | :-------- | :----------------- |
| Dashboard availability       | Vercel analytics + uptime monitoring     | 1 min     | > 5s response time |
| Supabase database            | Supabase Dashboard metrics               | 5 min     | > 80% CPU/RAM      |
| R2 version endpoint          | HTTP check on `master_version.json`      | 1 min     | Non-200 response   |
| Edge Function execution      | Supabase function logs                   | Per-invoke| Error rate > 5%    |

### Key Metrics

| Metric                      | Source           | Purpose                                     |
| :-------------------------- | :--------------- | :------------------------------------------ |
| Publish frequency           | `versions` table | Track deployment velocity                   |
| Config download count       | R2 analytics     | Understand player reach                     |
| Version adoption rate       | SDK telemetry    | How fast players receive updates            |
| Error rate (sync failures)  | SDK error events | Identify connectivity or integrity issues   |

### Logging

| Component       | Log Destination          | Retention     |
| :-------------- | :----------------------- | :------------ |
| Dashboard       | Vercel Log Drain         | 7 days (free) |
| Edge Functions  | Supabase Function Logs   | 7 days        |
| Database        | Supabase Dashboard       | 7 days        |
| Unity SDK       | Local device logs        | Per session   |

---

## 9.6 Cost Analysis

### Free Tier Coverage

| Service    | Free Tier Limits                         | Sufficient For                  |
| :--------- | :--------------------------------------- | :------------------------------ |
| Vercel     | 100 GB bandwidth, 100 builds/day        | Small-to-medium team dashboard  |
| Supabase   | 500 MB DB, 50K auth users, 500K Edge invocations | Up to ~10K DAU players |
| Cloudflare R2 | 10 GB storage, 10M reads/mo, 1M writes/mo | Up to ~300K DAU players   |

### Estimated Monthly Cost at Scale

| Scale         | Vercel   | Supabase | Cloudflare R2 | Total       |
| :------------ | :------- | :------- | :------------ | :---------- |
| 1K DAU        | $0       | $0       | $0            | **$0**      |
| 10K DAU       | $0       | $0       | $0            | **$0**      |
| 100K DAU      | $0       | $25      | $0            | **~$25**    |
| 1M DAU        | $20      | $25      | $3            | **~$48**    |
| 10M DAU       | $20      | $75      | $15           | **~$110**   |

> Unity Flux is designed to be operationally free for indie studios and extremely cost-effective at scale.

---

## 9.7 Disaster Recovery

| Scenario                    | Recovery Method                                        | RTO       |
| :-------------------------- | :----------------------------------------------------- | :-------- |
| Bad config published        | One-click rollback in dashboard                        | < 2 min   |
| Dashboard outage            | Vercel auto-recovery; players unaffected (CDN-served)  | < 5 min   |
| Supabase outage             | Players unaffected (read from R2); publishing paused   | Provider  |
| R2 outage                   | Players use local cache; new downloads queued          | Provider  |
| Database corruption         | Restore from Supabase automated daily backup           | < 1 hour  |
| Accidental version delete   | Re-publish from `version_entries` snapshot data        | < 10 min  |

---

**Previous:** [08 — Security Model](08-security.md)
**Back to Index:** [README](README.md)
