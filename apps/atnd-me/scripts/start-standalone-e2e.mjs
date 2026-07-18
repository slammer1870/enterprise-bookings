import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

/**
 * Playwright E2E production server launcher.
 *
 * Prefer `next start` (`E2E_USE_NEXT_START=true`, set by `pnpm start:e2e`).
 * Standalone copies under /tmp often break sharp's nested deps (e.g. missing
 * `semver/functions/coerce`). Running from the app workspace lets Node resolve
 * a single react/sharp install and avoids:
 *   - Cannot find module 'semver/functions/coerce'
 *   - sharp._isUsingX64V2 is not a function
 *   - Cannot read properties of null (reading 'useRef')
 *
 * Standalone mode: set `E2E_USE_NEXT_START=false` when `.next/standalone` exists.
 * Isolated under /tmp so workspace `node_modules` is not on the resolution walk.
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appRoot = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)

const sourceStandaloneRoot = path.join(appRoot, '.next', 'standalone')
const srcStaticDir = path.join(appRoot, '.next', 'static')

const useNextStart =
  process.env.E2E_USE_NEXT_START === 'true' ||
  process.env.E2E_USE_NEXT_START === '1' ||
  !fs.existsSync(path.join(sourceStandaloneRoot, 'apps', 'atnd-me', 'server.js'))

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
  // Dereference pnpm symlinks so native deps (sharp/@img) are real files under /tmp.
  fs.cpSync(sourceStandaloneRoot, isolatedStandaloneRoot, {
    recursive: true,
    dereference: true,
  })

  const standaloneAppDir = path.join(isolatedStandaloneRoot, 'apps', 'atnd-me')
  const standaloneNextDir = path.join(standaloneAppDir, '.next')
  ensureStatic(standaloneNextDir)

  return { standaloneAppDir, standaloneNextDir }
}

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
// Avoid inherited NODE_PATH pulling unexpected packages into resolution.
delete env.NODE_PATH

let child

if (useNextStart) {
  const buildIdPath = path.join(appRoot, '.next', 'BUILD_ID')
  if (!fs.existsSync(buildIdPath)) {
    throw new Error(
      `Missing Next.js BUILD_ID at ${buildIdPath}. Did you run a non-standalone \`pnpm build\`?`,
    )
  }
  if (!fs.existsSync(srcStaticDir)) {
    throw new Error(`Missing Next.js static dir: ${srcStaticDir}. Did you run \`pnpm build\`?`)
  }

  let nextBin
  try {
    nextBin = require.resolve('next/dist/bin/next', { paths: [appRoot] })
  } catch {
    throw new Error('Unable to resolve next binary from apps/atnd-me. Did you run \`pnpm install\`?')
  }

  // Point Next at the workspace sharp install (single version, with native bindings).
  try {
    env.NEXT_SHARP_PATH = path.dirname(require.resolve('sharp', { paths: [appRoot] }))
  } catch {
    // Optional: Next will try default resolution.
  }

  // next start reads next.config at runtime; keep standalone disabled so it doesn't warn.
  env.E2E_DISABLE_STANDALONE = 'true'

  console.log(`[e2e] starting via next start (cwd=${appRoot})`)
  child = spawn(process.execPath, [nextBin, 'start', '--hostname', '0.0.0.0', '--port', '3000'], {
    stdio: 'inherit',
    env,
    cwd: appRoot,
  })
} else {
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

  try {
    const sharpPath = require.resolve('sharp', {
      paths: [standaloneAppDir, path.join(path.dirname(standaloneAppDir), '..')],
    })
    env.NEXT_SHARP_PATH = path.dirname(sharpPath)
  } catch {
    // Standalone may already bundle sharp next to server.js.
  }

  console.log(`[e2e] starting via standalone server (cwd=${standaloneAppDir})`)
  child = spawn(process.execPath, ['server.js'], {
    stdio: 'inherit',
    env,
    cwd: standaloneAppDir,
  })
}

child.on('exit', (code) => process.exit(code ?? 0))
