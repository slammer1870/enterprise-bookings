// Import from the workspace package's local node_modules. The repo root doesn't
// have a direct dependency on @testcontainers/postgresql, so Node's resolver
// wouldn't find it.
import { PostgreSqlContainer } from '../packages/testing-config/node_modules/@testcontainers/postgresql/build/index.js'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const appDir = path.join(repoRoot, 'apps', 'atnd-me')

/**
 * Runs tests for `atnd-me` with a temporary Postgres container.
 *
 * Usage:
 *   node scripts/run-turbo-test-atnd-me-with-postgres.mjs
 *     → full suite via `turbo test --filter atnd-me`
 *
 *   node scripts/run-turbo-test-atnd-me-with-postgres.mjs tests/e2e/foo.spec.ts [...]
 *     → builds via `turbo build --filter atnd-me` (uses cache), then runs
 *       playwright against only the specified test files (skips unit/int tests)
 *
 *   PW_E2E_FAST=1 PW_E2E_BAIL=1 node scripts/run-turbo-test-atnd-me-with-postgres.mjs tests/e2e/foo.spec.ts
 *     → same, but with shorter timeouts and stop-after-first-failure (local dev)
 *
 * Why postgres is required:
 * - `turbo test` triggers a `next build` step for `atnd-me`
 * - some Next routes initialize Payload during "collect page data" during build
 * - Payload needs a live Postgres connection at build time
 *
 * Requirements:
 * - Docker must be running and accessible
 */
async function run(command, args, opts) {
  const child = spawn(command, args, { stdio: 'inherit', ...opts })
  return new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1))
  })
}

async function main() {
  const extraFiles = process.argv.slice(2)
  const targeted = extraFiles.length > 0

  const container = await new PostgreSqlContainer('postgres:16-alpine').start()
  const uri = container.getConnectionUri()

  const baseEnv = {
    ...process.env,
    // Payload config uses DATABASE_URI; other code may use DATABASE_URL.
    DATABASE_URI: uri,
    DATABASE_URL: uri,
    CI: process.env.CI ?? 'true',
    PAYLOAD_SECRET:
      process.env.PAYLOAD_SECRET ?? 'test-secret-key-for-ci-builds-only',
    // Ensure Next/Payload don't attempt to push schema changes.
    NODE_ENV: process.env.NODE_ENV ?? 'test',
  }

  try {
    let exitCode

    if (targeted) {
      // Build (or reuse cached build) via turbo, then run playwright against
      // only the specified files — skips unit/int tests entirely.
      const buildCode = await run('turbo', ['build', '--filter', 'atnd-me'], {
        env: baseEnv,
        cwd: repoRoot,
      })
      if (buildCode !== 0) {
        process.exitCode = buildCode
        return
      }

      const payloadAuthLoader = path.join(
        appDir,
        'scripts',
        'register-payload-auth-loader.mjs',
      )
      exitCode = await run(
        'pnpm',
        [
          'exec',
          'playwright',
          'test',
          '--config=playwright.config.ts',
          ...extraFiles,
        ],
        {
          cwd: appDir,
          env: {
            ...baseEnv,
            NODE_ENV: 'test',
            NODE_OPTIONS: `--no-deprecation --import ${payloadAuthLoader}`,
          },
        },
      )
    } else {
      exitCode = await run('turbo', ['test', '--filter', 'atnd-me'], {
        env: baseEnv,
        cwd: repoRoot,
      })
    }

    process.exitCode = exitCode
  } finally {
    await container.stop()
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

