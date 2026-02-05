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

# ---- builder: build atnd-me ----
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
# Create .next in the writable layer so Next.js build can write (avoids EROFS)
RUN mkdir -p /app/apps/atnd-me/.next
RUN corepack enable pnpm && pnpm --filter atnd-me build

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

# Entrypoint runs migrate (when possible) then starts the server
COPY apps/atnd-me/scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# Next.js standalone in monorepo places server at apps/atnd-me/
WORKDIR /app/apps/atnd-me

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
