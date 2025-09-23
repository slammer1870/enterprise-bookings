# Multi-stage Dockerfile optimized for Coolify deployment
# Stage 1: Dependencies and build
FROM node:18-alpine AS builder

# Install system dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy everything first (monorepo needs all workspace packages)
COPY . .

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Set build environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN pnpm run build --filter=bru-grappling

# Stage 2: Production runtime
FROM node:18-alpine AS runner

# Install system dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Create user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone build
COPY --from=builder --chown=nextjs:nodejs /app/apps/bru-grappling/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/bru-grappling/.next/static ./apps/bru-grappling/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/bru-grappling/public ./apps/bru-grappling/public

# Set production environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

USER nextjs

EXPOSE 3000

# Start the application using the standalone server
CMD ["node", "apps/bru-grappling/server.js"]
