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
  export type Locator = {
    waitFor(options?: { state?: string; timeout?: number }): Promise<void>
    click(): Promise<void>
    fill(value: string): Promise<void>
    setChecked(value: boolean): Promise<void>
    first(): Locator
    count(): Promise<number>
    isVisible(options?: { timeout?: number }): Promise<boolean>
  }

  export type Response = {
    url(): string
    status(): number
    request(): { method(): string }
    json(): Promise<unknown>
    text(): Promise<string>
  }

  export type APIResponse = {
    ok(): boolean
    status(): number
    json(): Promise<unknown>
    text(): Promise<string>
  }

  export type APIRequestContext = {
    get(url: string, options?: { timeout?: number }): Promise<APIResponse>
  }

  export type Page = {
    getByRole(role: string, options?: { name?: string | RegExp }): Locator
    locator(selector: string): Locator
    waitForResponse(
      predicate: (response: Response) => boolean,
      options?: { timeout?: number },
    ): Promise<Response>
    waitForLoadState(state?: string, options?: { timeout?: number }): Promise<void>
    waitForURL(url: string | RegExp, options?: { timeout?: number }): Promise<void>
    goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<void>
    waitForTimeout(timeoutMs: number): Promise<void>
    url(): string
    context(): { request: APIRequestContext }
  }

  export type PlaywrightTestConfig = Record<string, unknown>

  export function defineConfig(config: any): any

  export const devices: Record<string, Record<string, unknown>>

  export function expect(actual: unknown): {
    toBeEnabled(options?: { timeout?: number }): Promise<void>
    toHaveURL(url: string | RegExp, options?: { timeout?: number }): Promise<void>
  }
}


