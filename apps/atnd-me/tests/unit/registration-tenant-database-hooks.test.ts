/**
 * Unit tests for the Better Auth databaseHooks registration-tenant logic.
 *
 * The key regression being guarded: when a user signs up via the Better Auth
 * UI (`/auth/sign-up`), the hook's `context` argument may not carry `headers`
 * or `request`. `headersFromAuthContext` must return null in that case so the
 * hook exits cleanly, rather than throwing — and the
 * `POST /api/ensure-registration-tenant` endpoint is responsible for the
 * fallback assignment.
 *
 * Related:
 *   - ensure-registration-tenant-route.test.ts (endpoint that covers the gap)
 *   - tests/e2e/auth-sign-up-registration-tenant-custom-domain.e2e.spec.ts (E2E)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks (hoisted so dynamic imports inside the hook are intercepted)
// ---------------------------------------------------------------------------

const mockPayload = vi.hoisted(() => ({
  find: vi.fn(),
  findByID: vi.fn(),
}))

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

vi.mock('@/utilities/getTenantContext', () => ({
  getTenantIdForCreateRequest: vi.fn(),
}))

vi.mock('@/utilities/cookiesFromHeaders', () => ({
  cookiesFromHeaders: vi.fn().mockReturnValue({ get: () => undefined }),
}))

import { registrationTenantDatabaseHooks } from '@/lib/auth/registration-tenant-database-hooks'
import { getTenantIdForCreateRequest } from '@/utilities/getTenantContext'

// Shorthand to the specific hook function under test
const beforeHook = registrationTenantDatabaseHooks.user!.create!.before!

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registrationTenantDatabaseHooks.user.create.before', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Early-exit: already-set ------------------------------------------------

  it('returns undefined (no change) when registrationTenant is already set to a number', async () => {
    const result = await beforeHook({ email: 'a@a.com', registrationTenant: 42 }, {})
    expect(result).toBeUndefined()
    expect(getTenantIdForCreateRequest).not.toHaveBeenCalled()
  })

  it('returns undefined when registrationTenant is a non-empty string id', async () => {
    const result = await beforeHook({ email: 'a@a.com', registrationTenant: '42' }, {})
    expect(result).toBeUndefined()
    expect(getTenantIdForCreateRequest).not.toHaveBeenCalled()
  })

  // --- Early-exit: no headers in context (the bug scenario) -------------------

  it('returns undefined when context is null (no headers available)', async () => {
    const result = await beforeHook({ email: 'a@a.com' }, null)
    expect(result).toBeUndefined()
    expect(getTenantIdForCreateRequest).not.toHaveBeenCalled()
  })

  it('returns undefined when context is an empty object (no headers property)', async () => {
    // This is the scenario that caused the regression: Better Auth UI sign-up
    // did not populate context.headers or context.request.
    const result = await beforeHook({ email: 'a@a.com' }, {})
    expect(result).toBeUndefined()
    expect(getTenantIdForCreateRequest).not.toHaveBeenCalled()
  })

  it('returns undefined when context.headers is a plain object, not a Headers instance', async () => {
    const result = await beforeHook({ email: 'a@a.com' }, { headers: { host: 'studio.example.com' } })
    expect(result).toBeUndefined()
    expect(getTenantIdForCreateRequest).not.toHaveBeenCalled()
  })

  it('returns undefined when context.request is not a Request instance', async () => {
    const result = await beforeHook({ email: 'a@a.com' }, { request: { url: 'https://example.com' } })
    expect(result).toBeUndefined()
    expect(getTenantIdForCreateRequest).not.toHaveBeenCalled()
  })

  // --- Tenant resolution path ------------------------------------------------

  it('returns { data: { registrationTenant } } when context.headers is a Headers instance', async () => {
    ;(getTenantIdForCreateRequest as ReturnType<typeof vi.fn>).mockResolvedValue(7)
    const headers = new Headers({ host: 'studio.example.com' })

    const result = await beforeHook({ email: 'a@a.com' }, { headers })

    expect(result).toEqual({ data: { registrationTenant: 7 } })
    expect(getTenantIdForCreateRequest).toHaveBeenCalledWith(
      mockPayload,
      expect.objectContaining({ headers }),
    )
  })

  it('returns { data: { registrationTenant } } when context.request is a Request instance', async () => {
    ;(getTenantIdForCreateRequest as ReturnType<typeof vi.fn>).mockResolvedValue(7)
    const request = new Request('https://studio.example.com/api/auth/sign-up')

    const result = await beforeHook({ email: 'a@a.com' }, { request })

    expect(result).toEqual({ data: { registrationTenant: 7 } })
    expect(getTenantIdForCreateRequest).toHaveBeenCalledWith(
      mockPayload,
      expect.objectContaining({ headers: request.headers }),
    )
  })

  // --- No tenant resolved ----------------------------------------------------

  it('returns undefined when headers are present but no tenant resolves', async () => {
    ;(getTenantIdForCreateRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const headers = new Headers({ host: 'unknown.example.com' })

    const result = await beforeHook({ email: 'a@a.com' }, { headers })

    expect(result).toBeUndefined()
  })

  it('returns undefined when getTenantIdForCreateRequest resolves to an empty string', async () => {
    ;(getTenantIdForCreateRequest as ReturnType<typeof vi.fn>).mockResolvedValue('')
    const headers = new Headers({ host: 'studio.example.com' })

    const result = await beforeHook({ email: 'a@a.com' }, { headers })

    expect(result).toBeUndefined()
  })
})
