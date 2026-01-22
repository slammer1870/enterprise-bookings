import { execSync } from 'node:child_process'
import * as os from 'node:os'

const DEFAULT_PORT = 3000

/**
 * Kill any process listening on the given TCP port.
 * Uses lsof + process.kill on Unix (macOS/Linux); netstat + taskkill on Windows.
 * Safe to call when nothing is listening (no-op).
 */
export function killProcessOnPort(port: number = DEFAULT_PORT): void {
  try {
    if (os.platform() === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      const lines = out.trim().split(/\r?\n/)
      const pids = new Set<string>()
      for (const line of lines) {
        const m = line.trim().split(/\s+/)
        const pid = m[m.length - 1]
        if (pid && /^\d+$/.test(pid)) pids.add(pid)
      }
      for (const pid of pids) {
        execSync(`taskkill /f /pid ${pid}`, { stdio: 'ignore' })
      }
      if (pids.size) console.log(`Killed process(es) listening on port ${port}`)
    } else {
      const out = execSync(`lsof -ti tcp:${port}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      const pids = out.trim().split(/\s+/).filter(Boolean)
      for (const pid of pids) {
        const n = parseInt(pid, 10)
        if (!Number.isNaN(n)) process.kill(n, 'SIGKILL')
      }
      if (pids.length) console.log(`Killed process(es) listening on port ${port}`)
    }
  } catch {
    // lsof / netstat exit non-zero when nothing found; ignore
  }
}
