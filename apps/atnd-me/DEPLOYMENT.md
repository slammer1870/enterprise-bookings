# atnd-me deployment (Coolify / Docker)

## Build

Build the image from the **monorepo root** (context must be repo root so workspace packages and `scripts/` resolve):

```bash
# From repo root
docker build -f apps/atnd-me/Dockerfile -t atnd-me .
```

Or with docker compose from this directory:

```bash
docker compose -f apps/atnd-me/docker-compose.yml build
```

## Environment

### Required

| Variable | Description |
|---------|-------------|
| `DATABASE_URI` | Postgres connection string (e.g. from Coolify Postgres or external). |
| `PAYLOAD_SECRET` | Secret for Payload sessions/JWT. |
| `NEXT_PUBLIC_SERVER_URL` | Root URL of the app with no subdomain (e.g. `https://atnd-me.com`). Required for subdomain multi-tenancy (cookie domain and auth). |

### Optional

| Variable | Description |
|---------|-------------|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Auth | Better Auth URL and related vars as used in the app. |
| `PREVIEW_SECRET`, `SEED_SECRET`, `CRON_SECRET` | For preview, seed, and cron endpoints. |
| Sentry | As configured in the app. |

Use `.env` or Coolify env UI; do not commit secrets.

## Coolify

1. **Build**
   - Build context: repo root (e.g. root of the git clone).
   - Dockerfile path: `apps/atnd-me/Dockerfile`.

2. **Database**
   - Add a Postgres service in Coolify or use an external Postgres.
   - Set `DATABASE_URI` on the atnd-me service to that Postgres URL.

3. **Migrations**
   - The container does not run Payload migrations on start (standalone image has no Payload CLI).
   - Run migrations once after deploy or after schema changes:
     - In Coolify: use “Run Command” (or equivalent) to run inside the app container or a one-off job.
     - From host (with repo and `DATABASE_URI` set):  
       `pnpm --filter atnd-me exec payload migrate run --force-accept-warning`  
       or from `apps/atnd-me`:  
       `pnpm payload migrate run --force-accept-warning`.

4. **Public URL**
   - Set `NEXT_PUBLIC_SERVER_URL` to the public URL Coolify assigns (e.g. `https://your-app.coolify.io`).

## Multi-tenancy via subdomains (Coolify)

atnd-me resolves tenants by **subdomain**: each tenant has a slug (e.g. `acme`), and users reach it at `https://acme.yourdomain.com`. The root domain (e.g. `https://yourdomain.com`) shows the marketing/tenant list page.

### 1. Set the root URL

Set **`NEXT_PUBLIC_SERVER_URL`** to the **root** URL of the app (no subdomain):

- Custom domain: `https://atnd-me.com` (so tenants are `https://tenant1.atnd-me.com`)
- Coolify default: `https://your-app.coolify.io` (so tenants are `https://tenant1.your-app.coolify.io`)

The app uses this for:

- Cookie domain (so `tenant-slug` works across `*.yourdomain.com`)
- Better Auth trusted origins (`*.yourdomain.com`)
- Links on the tenant list page (`/tenants`)

### 2. Wildcard DNS / Coolify domain

Traffic for **all** subdomains must reach the same app:

- **Custom domain**: Create a **wildcard** DNS A or CNAME record, e.g. `*.atnd-me.com` → your Coolify server (or proxy). In Coolify, add the domain `atnd-me.com` to the application and enable wildcard so `*.atnd-me.com` is accepted.
- **Coolify subdomain**: If Coolify gives you `yourapp.89.167.25.252.sslip.io`, check whether it supports wildcards (e.g. `*.yourapp.89.167.25.252.sslip.io`). If not, use a custom domain with a wildcard for production.

### 3. Coolify configuration

- **Domain**: Use your root domain (e.g. `atnd-me.com`) or the Coolify-generated domain. If your provider supports it, enable **wildcard** so `*.atnd-me.com` is routed to this service.
- **Port**: Expose `3000` as usual.
- **Env**: `NEXT_PUBLIC_SERVER_URL` must be exactly the root URL (e.g. `https://atnd-me.com`), with no trailing slash.

### 4. Tenants in Payload

Each tenant is a document in the **Tenants** collection with a **slug** that matches the subdomain:

- Slug `acme` → users visit `https://acme.atnd-me.com`
- Slug `studio-one` → users visit `https://studio-one.atnd-me.com`

Create tenants in the Payload admin at `https://yourdomain.com/admin` (or your root URL). The **slug** must be valid as a subdomain (lowercase, no spaces; use hyphens if needed, e.g. `studio-one`).

### 5. Flow summary

| URL | Behaviour |
|-----|-----------|
| `https://atnd-me.com` | Root: tenant list / marketing. |
| `https://acme.atnd-me.com` | Tenant “acme”: schedule, bookings, etc. |
| `https://atnd-me.com/admin` | Payload admin (shared). |

Middleware reads the `Host` header, derives the subdomain, and sets the `tenant-slug` cookie so the rest of the app knows the current tenant.

## Local dev with Docker (optional)

For a full stack with Postgres, use an override or a separate compose file that adds a Postgres service and sets `DATABASE_URI` for the app. Example (not in repo): add a `postgres` service and point the app’s `DATABASE_URI` at it.
