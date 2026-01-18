import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

/**
 * Return webpack aliases that force a single physical @payloadcms/ui instance.
 *
 * Why:
 * - pnpm can install multiple physical copies of the "same" @payloadcms/ui version due to peer variants
 * - Payload Admin relies on React context providers inside @payloadcms/ui
 * - if provider and consumer come from different physical copies, hooks like list sorting can crash
 *
 * Strategy:
 * - Prefer the @payloadcms/ui instance linked alongside @payloadcms/next in pnpm virtual store
 *   (since @payloadcms/next depends on @payloadcms/ui)
 * - Fall back to pnpm's injected path (node_modules/.pnpm/node_modules/@payloadcms/ui)
 * - Final fallback: derive from require.resolve('@payloadcms/ui')
 */
export function getPayloadUIAliases({ from = import.meta.url, cwd = process.cwd() } = {}) {
  const require = createRequire(from)

  // appDir is the Next app root when used inside next.config webpack() hook
  const workspaceRoot = path.resolve(cwd, '../..')
  const pnpmInjectedUiDir = path.join(workspaceRoot, 'node_modules/.pnpm/node_modules/@payloadcms/ui')

  let payloadUiDir

  // Prefer: UI variant that @payloadcms/next is linked to inside pnpm virtual store
  try {
    const payloadNextEntry = require.resolve('@payloadcms/next/withPayload')
    const nextMarker = `${path.sep}@payloadcms${path.sep}next${path.sep}`
    const nextMarkerIdx = payloadNextEntry.lastIndexOf(nextMarker)
    const payloadNextDir =
      nextMarkerIdx === -1
        ? path.dirname(payloadNextEntry)
        : payloadNextEntry.slice(0, nextMarkerIdx + nextMarker.length)
    // pnpm places "@payloadcms/ui" as a sibling link next to "@payloadcms/next" within the same virtual-store dir
    const payloadUiFromNextDir = path.join(path.dirname(payloadNextDir), 'ui')
    if (fs.existsSync(payloadUiFromNextDir)) {
      payloadUiDir = fs.realpathSync(payloadUiFromNextDir)
    }
  } catch {
    // ignore, fall back
  }

  // Fall back: pnpm injected NODE_PATH style location
  if (!payloadUiDir && fs.existsSync(pnpmInjectedUiDir)) {
    payloadUiDir = fs.realpathSync(pnpmInjectedUiDir)
  }

  // Final fallback: direct resolution (may not work in all pnpm workspace layouts)
  if (!payloadUiDir) {
    const payloadUiEntry = require.resolve('@payloadcms/ui')
    const marker = `${path.sep}@payloadcms${path.sep}ui${path.sep}`
    const markerIdx = payloadUiEntry.lastIndexOf(marker)
    payloadUiDir =
      markerIdx === -1 ? path.dirname(payloadUiEntry) : payloadUiEntry.slice(0, markerIdx + marker.length)
  }

  const payloadUiEntryFile = path.join(payloadUiDir, 'dist/exports/client/index.js')
  const payloadUiSharedEntryFile = path.join(payloadUiDir, 'dist/exports/shared/index.js')
  const payloadUiRscEntryFile = path.join(payloadUiDir, 'dist/exports/rsc/index.js')
  const payloadUiDistDir = path.join(payloadUiDir, 'dist')

  return {
    // exact entrypoints
    '@payloadcms/ui$': payloadUiEntryFile,
    '@payloadcms/ui/shared$': payloadUiSharedEntryFile,
    '@payloadcms/ui/rsc$': payloadUiRscEntryFile,
    // deep imports (map @payloadcms/ui/<subpath> -> <pkg>/dist/<subpath>)
    '@payloadcms/ui/dist/': `${payloadUiDistDir}${path.sep}`,
    '@payloadcms/ui/': `${payloadUiDistDir}${path.sep}`,
  }
}

