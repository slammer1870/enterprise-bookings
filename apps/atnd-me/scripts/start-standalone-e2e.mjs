import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * Playwright E2E uses Next.js "standalone" output (`node .next/standalone/.../server.js`).
 *
 * Next's standalone server expects `./.next/static` to exist relative to the standalone app dir.
 * In this monorepo, the build artifacts can leave the static directory outside the standalone dir,
 * which causes `_next/static/*` to 404 and breaks hydration (click handlers never attach).
 *
 * This script ensures the static assets are present before launching the standalone server.
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appRoot = path.resolve(__dirname, '..')

const standaloneAppDir = path.join(appRoot, '.next', 'standalone', 'apps', 'atnd-me')
const standaloneNextDir = path.join(standaloneAppDir, '.next')

const srcStaticDir = path.join(appRoot, '.next', 'static')
const dstStaticDir = path.join(standaloneNextDir, 'static')

const ensureStatic = () => {
  if (!fs.existsSync(srcStaticDir)) {
    throw new Error(`Missing Next.js static dir: ${srcStaticDir}. Did you run \`pnpm build\`?`)
  }

  // Always refresh the standalone static directory.
  // Next's standalone output does not guarantee `static/` is bundled in-place,
  // and hashed chunk filenames change between builds. Reusing an old static dir
  // causes `_next/static/*` 404s and breaks hydration.
  fs.mkdirSync(standaloneNextDir, { recursive: true })
  fs.rmSync(dstStaticDir, { recursive: true, force: true })
  fs.cpSync(srcStaticDir, dstStaticDir, { recursive: true, force: true })
}

ensureStatic()

const serverEntrypoint = path.join(standaloneAppDir, 'server.js')
if (!fs.existsSync(serverEntrypoint)) {
  throw new Error(`Missing standalone server entrypoint: ${serverEntrypoint}. Did you run \`pnpm build\`?`)
}

const buildIdPath = path.join(standaloneNextDir, 'BUILD_ID')
if (!fs.existsSync(buildIdPath)) {
  throw new Error(
    `Missing Next.js BUILD_ID in standalone output: ${buildIdPath}. ` +
      'Ensure the e2e-build artifact includes apps/atnd-me/.next/standalone.',
  )
}

// Ensure E2E env is passed so Stripe test-account mocking runs (avoids "does not have access to account" in tests).
const payloadAuthRegister = path.join(__dirname, 'register-payload-auth-loader.mjs')
const baseNodeOptions = process.env.NODE_OPTIONS ?? ''
const loaderNodeOptions = `--import ${payloadAuthRegister}`

// Ensure the child process has the payload-auth resolver registered.
// We set NODE_OPTIONS explicitly here because relative `NODE_OPTIONS=--import ./scripts/...`
// can break depending on the current working directory used by the parent process.
const cleanedBaseNodeOptions = baseNodeOptions
  // Remove any payload-auth loader registration (relative or absolute).
  .replace(/--import\s+["']?[^"'\s]+register-payload-auth-loader\.mjs["']?\s*/g, '')
  // Avoid double `--no-deprecation` (we always re-add it below).
  .replace(/--no-deprecation\s*/g, '')

const env = {
  ...process.env,
  ENABLE_TEST_WEBHOOKS: 'true',
  // Shared secret for /api/tenant-by-host and /api/tenant-by-slug internal calls.
  // Middleware reads this at runtime to build the Authorization header; the route
  // handler checks it.  Must be set to the same value in both places.
  INTERNAL_TENANT_RESOLVE_TOKEN: process.env.INTERNAL_TENANT_RESOLVE_TOKEN ?? 'e2e-internal-test-secret',
  NODE_OPTIONS: `${cleanedBaseNodeOptions} --no-deprecation ${loaderNodeOptions}`.trim(),
}
const child = spawn(process.execPath, ['server.js'], {
  stdio: 'inherit',
  env,
  cwd: standaloneAppDir,
})

child.on('exit', (code) => process.exit(code ?? 0))

