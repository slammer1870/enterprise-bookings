import fs from 'fs'
import os from 'os'
import path from 'path'

/**
 * Test-only latch between the booking page's capacity snapshot and the
 * viewer-hold lookup. Playwright's sync XHR on reload finishes before the
 * next document, so the race production hits (capacity still counts the
 * hold, then release-hold drops it) never happens unless the render waits.
 * Off unless the e2e server and the e2e-split-hold-read cookie are both set.
 */
export function e2eHoldReadSplitPaths(timeslotId: number) {
  const dir = path.join(os.tmpdir(), 'enterprise-bookings-e2e-hold-read-split', String(timeslotId))
  return {
    dir,
    paused: path.join(dir, 'paused'),
    go: path.join(dir, 'go'),
  }
}

export function resetE2eHoldReadSplit(timeslotId: number) {
  fs.rmSync(e2eHoldReadSplitPaths(timeslotId).dir, { recursive: true, force: true })
}

export function signalE2eHoldReadSplit(timeslotId: number) {
  const { dir, go } = e2eHoldReadSplitPaths(timeslotId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(go, String(Date.now()))
}

export async function pauseBeforeViewerHoldLookup(timeslotId: number, enabled: boolean) {
  if (!enabled || process.env.PW_E2E_PROFILE !== 'true') return
  if (!Number.isFinite(timeslotId)) return

  const { dir, paused, go } = e2eHoldReadSplitPaths(timeslotId)
  if (fs.existsSync(go)) return

  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(paused, String(Date.now()))

  const deadline = Date.now() + 45_000
  while (!fs.existsSync(go) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}
