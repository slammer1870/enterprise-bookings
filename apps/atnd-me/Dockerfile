# atnd-me Docker image for Coolify (monorepo-aware).
# Build from repo root with: docker build -f apps/atnd-me/Dockerfile .
# Requires next.config.js to set output: 'standalone'.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# ---- deps: install workspace dependencies ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ apps/
COPY packages/ packages/
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ---- builder: run migrations then build atnd-me ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY scripts/ scripts/
COPY turbo.json ./
# DATABASE_URI must be provided at build time so migrations run before the build.
# If migrations fail, the build fails (no image is produced).
ARG DATABASE_URI
ENV DATABASE_URI=${DATABASE_URI}
RUN corepack enable pnpm && \
  pnpm --filter atnd-me exec payload migrate run --force-accept-warning
# Skip migrations during next build (DB already migrated above; avoids duplicate-key errors).
ENV SKIP_PAYLOAD_MIGRATIONS=1
# Create .next in the writable layer so Next.js build can write (avoids EROFS)
RUN mkdir -p /app/apps/atnd-me/.next
RUN pnpm --filter atnd-me build
# Standalone can miss require-in-the-middle (Sentry/OpenTelemetry load it at runtime). Copy it so
# Payload admin and instrumentation work in production.
RUN mkdir -p /app/apps/atnd-me/.next/standalone/node_modules && \
  (for d in /app/node_modules/.pnpm/require-in-the-middle@*/node_modules/require-in-the-middle; do \
     [ -d "$$d" ] && cp -r "$$d" /app/apps/atnd-me/.next/standalone/node_modules/ && break; \
   done)

# ---- runner: minimal production image ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone output (monorepo: server.js is at apps/atnd-me/server.js)
COPY --from=builder --chown=nextjs:nodejs /app/apps/atnd-me/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/atnd-me/.next/static ./apps/atnd-me/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/atnd-me/public ./apps/atnd-me/public

# Entrypoint starts the server (migrations are not run here; see DEPLOYMENT.md)
COPY apps/atnd-me/scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# Next.js standalone in monorepo places server at apps/atnd-me/
WORKDIR /app/apps/atnd-me

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
