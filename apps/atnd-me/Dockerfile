# syntax=docker/dockerfile:1
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
  printf 'y\n' | pnpm --filter atnd-me exec payload migrate --force-accept-warning
# Skip migrations during next build (DB already migrated above; avoids duplicate-key errors).
ENV SKIP_PAYLOAD_MIGRATIONS=1
# Create .next in the writable layer so Next.js build can write (avoids EROFS)
RUN mkdir -p /app/apps/atnd-me/.next
RUN pnpm --filter atnd-me build
# Standalone + pnpm omit runtime deps of serverExternalPackages (sharp, Sentry).
# Copy them beside sharp (and into standalone root) and fail the build if sharp
# still cannot resolve detect-libc — silent shell copies previously masked this.
RUN node <<'EOF'
const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

const requireFromApp = createRequire('/app/apps/atnd-me/package.json')
const sharpPkgJson = requireFromApp.resolve('sharp/package.json')
const requireFromSharp = createRequire(sharpPkgJson)
const sharpStoreNm = path.dirname(path.dirname(sharpPkgJson)) // .../sharp@x/node_modules
const standaloneRoot = '/app/apps/atnd-me/.next/standalone'
const targets = [
  path.join(standaloneRoot, 'node_modules'),
  path.join(standaloneRoot, 'apps/atnd-me/node_modules'),
  path.join(standaloneRoot, 'apps/atnd-me/node_modules/sharp/node_modules'),
]

function copyPkg(name, resolver) {
  const src = path.dirname(resolver.resolve(`${name}/package.json`))
  for (const destRoot of targets) {
    fs.mkdirSync(destRoot, { recursive: true })
    const dest = path.join(destRoot, name)
    fs.cpSync(src, dest, { recursive: true, dereference: true })
    console.log(`copied ${name} -> ${dest}`)
  }
}

function copyDir(name, src) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing ${name} at ${src}`)
  }
  for (const destRoot of targets) {
    fs.mkdirSync(destRoot, { recursive: true })
    const dest = path.join(destRoot, name)
    fs.cpSync(src, dest, { recursive: true, dereference: true })
    console.log(`copied ${name}/ -> ${dest}`)
  }
}

copyPkg('require-in-the-middle', requireFromApp)
copyPkg('detect-libc', requireFromSharp)
copyPkg('semver', requireFromSharp)
// Alpine (musl) native bindings — Next standalone tracing drops these under pnpm.
copyDir('@img', path.join(sharpStoreNm, '@img'))

const sharpPkg = path.join(
  standaloneRoot,
  'apps/atnd-me/node_modules/sharp/package.json',
)
if (!fs.existsSync(sharpPkg)) {
  throw new Error(`Expected sharp in standalone at ${sharpPkg}`)
}
const requireStandaloneSharp = createRequire(sharpPkg)
requireStandaloneSharp.resolve('detect-libc')
// Load sharp itself so missing linuxmusl binaries fail the image build.
requireStandaloneSharp(path.dirname(sharpPkg))
console.log('verified: standalone sharp loads (native bindings ok)')
EOF

# ---- runner: minimal production image ----
FROM base AS runner
WORKDIR /app

# Coolify (and Docker HEALTHCHECK) need curl or wget to probe http://localhost:3000/admin
RUN apk add --no-cache curl

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
