# 08 — Security Model

> **Document Type:** Security Specification
> **Audience:** Security engineers, backend developers, DevOps

---

## 8.1 Overview

Unity Flux handles game configuration data that, while not containing personally identifiable information (PII), must be protected against unauthorized modification and tampering. The security model covers four domains:

1. **Authentication** — Who can access the system?
2. **Authorization** — What can they do?
3. **Data Integrity** — How do we prevent tampering?
4. **Infrastructure Security** — How is the deployment protected?

---

## 8.2 Threat Model

| Threat                              | Risk Level | Mitigation                                                  |
| :---------------------------------- | :--------- | :---------------------------------------------------------- |
| Unauthorized dashboard access       | High       | Supabase Auth + RLS + session middleware                    |
| Config tampering during transit     | Medium     | SHA-256 hash verification on client                         |
| R2 bucket unauthorized writes       | High       | Private write access (API key), public read only            |
| Stale/poisoned cache on client      | Low        | Hash-based cache invalidation, integrity check              |
| DDoS on CDN endpoints               | Medium     | Cloudflare WAF + rate limiting + DDoS protection            |
| API key exposure in client build     | Medium     | Only anon key in client; service role key server-side only  |
| SQL injection via data editor        | Medium     | Parameterized queries via Supabase SDK + RLS                |
| Cross-Site Scripting (XSS)           | Medium     | React's built-in escaping + CSP headers on Vercel           |

---

## 8.3 Authentication Architecture

### Admin Users (Dashboard)

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│ Designer │────▶│  Next.js     │────▶│  Supabase   │
│          │     │  Middleware   │     │  Auth API   │
└──────────┘     │  (JWT check) │     │  (JWT issue)│
                 └──────────────┘     └─────────────┘
```

- **Method:** Email/Password or SSO (SAML)
- **Session:** JWT stored in httpOnly cookie (not localStorage)
- **Expiry:** Access token: 1 hour. Refresh token: 7 days.
- **MFA:** Supported via Supabase Auth (TOTP)

### Players (Unity Client)

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Player  │────▶│  Flux SDK    │────▶│  Supabase   │
│          │     │  AuthService │     │  Auth API   │
└──────────┘     └──────────────┘     └─────────────┘
```

- **Anonymous:** Default. Device-bound UUID. No user interaction.
- **Social Login:** Google, Facebook, Apple. Used for cross-device progression.
- **Token Storage:** Stored in Unity's `PlayerPrefs` (encrypted on supported platforms).

---

## 8.4 Authorization Matrix

### Dashboard Roles

| Permission           | Admin | Editor | Viewer |
| :------------------- | :---: | :----: | :----: |
| Create project       |  Yes  |   No   |   No   |
| Create/edit schemas  |  Yes  |   No   |   No   |
| Create/edit entries  |  Yes  |  Yes   |   No   |
| View entries         |  Yes  |  Yes   |  Yes   |
| Publish version      |  Yes  |   No   |   No   |
| Rollback version     |  Yes  |   No   |   No   |
| Manage team members  |  Yes  |   No   |   No   |
| View version history |  Yes  |  Yes   |  Yes   |

### Enforcement Layers

1. **UI Layer** — Buttons/actions hidden based on role (defense in depth, not primary enforcement).
2. **API Layer** — Next.js middleware validates JWT and role before processing requests.
3. **Database Layer** — Supabase RLS policies enforce access rules even if API layer is bypassed.

---

## 8.5 Data Integrity

### Publishing Pipeline

```
Compile JSON  →  SHA-256 hash  →  Upload to R2  →  Store hash in DB + version pointer
```

### Client-Side Verification

```
Download config  →  Compute SHA-256  →  Compare with master_version.json hash
                                        ├── Match: Accept and cache
                                        └── Mismatch: Reject, retry, or use cached version
```

### Atomic Publishing

The version pointer (`master_version.json`) is the **last** file updated during publishing. This prevents clients from downloading partially uploaded or corrupted configs:

| Upload Sequence | File                     | State if Interrupted Here          |
| :-------------- | :----------------------- | :--------------------------------- |
| Step 1          | `config_v1.2.4.json`     | Old pointer still valid            |
| Step 2          | `master_version.json`    | New pointer → new complete config  |

---

## 8.6 Infrastructure Security

### Vercel (Dashboard Hosting)

| Control                    | Implementation                                    |
| :------------------------- | :------------------------------------------------ |
| HTTPS                      | Enforced (automatic TLS)                          |
| Environment variables      | Vercel Secret Management (encrypted at rest)       |
| CSP Headers                | Configured via `next.config.js`                    |
| CORS                       | Restricted to known origins                        |
| Preview deployments        | Password-protected or team-only access             |

### Supabase (Backend)

| Control                    | Implementation                                    |
| :------------------------- | :------------------------------------------------ |
| RLS                        | Enabled on all tables (see [03](03-database-design.md)) |
| Service Role Key           | Server-side only — never exposed to client         |
| Anon Key                   | Used by Unity SDK — limited to auth and public reads|
| SSL                        | Enforced for all database connections               |
| Backups                    | Automated daily backups (Supabase managed)          |

### Cloudflare R2 (CDN)

| Control                    | Implementation                                    |
| :------------------------- | :------------------------------------------------ |
| Write access               | API key with HMAC signing — server-side only       |
| Read access                | Public via custom domain                           |
| WAF                        | Cloudflare Web Application Firewall enabled        |
| Rate limiting              | Configured per-endpoint via Cloudflare rules       |
| DDoS protection            | Cloudflare's built-in L3/L4/L7 mitigation         |

---

## 8.7 Secrets Management

| Secret                       | Storage Location               | Access                         |
| :--------------------------- | :----------------------------- | :----------------------------- |
| Supabase Service Role Key    | Vercel Secret Management       | Edge Functions only            |
| Supabase Anon Key            | Vercel env + Unity SDK config  | Dashboard client + Unity SDK   |
| R2 API Token                 | Vercel Secret Management       | Edge Functions only            |
| R2 Access Key / Secret Key   | Vercel Secret Management       | Edge Functions only            |
| OAuth Client Secrets         | Supabase Auth configuration    | Supabase Auth service only     |

> **Rule:** No secret with write access ever reaches the client (browser or Unity build).

---

**Previous:** [07 — Data Flow & Lifecycle](07-data-flow.md)
**Next:** [09 — Deployment & Operations](09-deployment.md)
