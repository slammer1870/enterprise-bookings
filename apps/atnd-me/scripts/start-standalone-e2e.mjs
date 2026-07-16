import fs from 'node:fs'
import os from 'node:os'
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
 * When the app has workspace `node_modules` (CI runners after `pnpm install`), Node walks up from
 * the standalone cwd and loads duplicate react/sharp copies from `apps/atnd-me/node_modules`,
 * causing SSR errors like `useRef` on null and `sharp._isUsingX64V2 is not a function`.
 * Copy standalone output to a temp dir with no workspace parents before launching.
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appRoot = path.resolve(__dirname, '..')

const sourceStandaloneRoot = path.join(appRoot, '.next', 'standalone')
const srcStaticDir = path.join(appRoot, '.next', 'static')

const shouldIsolateStandalone =
  process.env.E2E_ISOLATE_STANDALONE === 'true' ||
  process.env.E2E_ISOLATE_STANDALONE === '1' ||
  process.env.CI === 'true' ||
  process.env.CI === '1' ||
  fs.existsSync(path.join(appRoot, 'node_modules'))

const ensureStatic = (standaloneNextDir) => {
  if (!fs.existsSync(srcStaticDir)) {
    throw new Error(`Missing Next.js static dir: ${srcStaticDir}. Did you run \`pnpm build\`?`)
  }

  const dstStaticDir = path.join(standaloneNextDir, 'static')

  // Always refresh the standalone static directory.
  fs.mkdirSync(standaloneNextDir, { recursive: true })
  fs.rmSync(dstStaticDir, { recursive: true, force: true })
  fs.cpSync(srcStaticDir, dstStaticDir, { recursive: true, force: true })
}

const prepareStandaloneLayout = () => {
  if (!fs.existsSync(sourceStandaloneRoot)) {
    throw new Error(
      `Missing Next.js standalone output: ${sourceStandaloneRoot}. Did you run \`pnpm build\`?`,
    )
  }

  if (!shouldIsolateStandalone) {
    const standaloneAppDir = path.join(sourceStandaloneRoot, 'apps', 'atnd-me')
    const standaloneNextDir = path.join(standaloneAppDir, '.next')
    ensureStatic(standaloneNextDir)
    return { standaloneAppDir, standaloneNextDir }
  }

  const isolatedRoot = path.join(os.tmpdir(), 'atnd-me-e2e-standalone')
  const isolatedStandaloneRoot = path.join(isolatedRoot, 'standalone')

  fs.rmSync(isolatedRoot, { recursive: true, force: true })
  fs.mkdirSync(isolatedRoot, { recursive: true })
  fs.cpSync(sourceStandaloneRoot, isolatedStandaloneRoot, { recursive: true })

  const standaloneAppDir = path.join(isolatedStandaloneRoot, 'apps', 'atnd-me')
  const standaloneNextDir = path.join(standaloneAppDir, '.next')
  ensureStatic(standaloneNextDir)

  return { standaloneAppDir, standaloneNextDir }
}

const { standaloneAppDir, standaloneNextDir } = prepareStandaloneLayout()

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

const cleanedBaseNodeOptions = baseNodeOptions
  .replace(/--import\s+["']?[^"'\s]+register-payload-auth-loader\.mjs["']?\s*/g, '')
  .replace(/--no-deprecation\s*/g, '')

const env = {
  ...process.env,
  ENABLE_TEST_WEBHOOKS: 'true',
  INTERNAL_TENANT_RESOLVE_TOKEN: process.env.INTERNAL_TENANT_RESOLVE_TOKEN ?? 'e2e-internal-test-secret',
  NODE_OPTIONS: `${cleanedBaseNodeOptions} --no-deprecation ${loaderNodeOptions}`.trim(),
}

const child = spawn(process.execPath, ['server.js'], {
  stdio: 'inherit',
  env,
  cwd: standaloneAppDir,
})

child.on('exit', (code) => process.exit(code ?? 0))
