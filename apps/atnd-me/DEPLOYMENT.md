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
| `NEXT_PUBLIC_SERVER_URL` | Public URL of the app (e.g. `https://atnd-me.example.com`). |

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

## Local dev with Docker (optional)

For a full stack with Postgres, use an override or a separate compose file that adds a Postgres service and sets `DATABASE_URI` for the app. Example (not in repo): add a `postgres` service and point the app’s `DATABASE_URI` at it.
