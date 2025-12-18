// Minimal type shims to allow this package to typecheck in environments where
// workspace dependency installation is restricted (e.g., sandboxed CI/linting).
//
// When node/@playwright types are available, they will override these.

declare module 'node:os' {
  const os: {
    cpus(): Array<unknown>
  }
  export default os
}

declare const process: {
  env: Record<string, string | undefined>
}

declare module '@playwright/test' {
  export type APIRequestContext = {
    get(url: string, options?: { timeout?: number }): Promise<{ ok(): boolean }>
  }

  export type PlaywrightTestConfig = Record<string, unknown>

  export function defineConfig(config: any): any

  export const devices: Record<string, Record<string, unknown>>
}


