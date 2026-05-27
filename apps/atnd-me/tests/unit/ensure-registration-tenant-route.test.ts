/**
 * Unit tests for POST /api/ensure-registration-tenant.
 *
 * This endpoint is the fallback that assigns registrationTenant for users who
 * completed Better Auth UI sign-up when the databaseHooks context lacked
 * request headers (causing the hook to silently skip tenant assignment).
 *
 * It is called from BetterAuthUIProvider.onSessionChange and is idempotent:
 * users who already have a registrationTenant are never updated.
 *
 * Related:
 *   - registration-tenant-database-hooks.test.ts (primary assignment path)
 *   - tests/e2e/auth-sign-up-registration-tenant-custom-domain.e2e.spec.ts (E2E)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const { mockPayload } = vi.hoisted(() => ({
  mockPayload: {
    auth: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}))

vi.mock('@/utilities/getTenantContext', () => ({
  getTenantIdForCreateRequest: vi.fn(),
}))

import { POST } from '@/app/api/ensure-registration-tenant/route'
import { getTenantIdForCreateRequest } from '@/utilities/getTenantContext'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(headers: Record<string, string> = {}) {
  return {
    headers: new Headers(headers),
    nextUrl: new URL('http://localhost:3000/api/ensure-registration-tenant'),
    cookies: { get: () => undefined },
  } as unknown as import('next/server').NextRequest
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/ensure-registration-tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Authentication -------------------------------------------------------

  it('returns 401 when no session exists', async () => {
    mockPayload.auth.mockResolvedValue({ user: null })

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('unauthenticated')
    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  it('returns 401 when auth result has no user id', async () => {
    mockPayload.auth.mockResolvedValue({ user: { email: 'x@x.com' } }) // id missing

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.reason).toBe('unauthenticated')
  })

  // --- Idempotency (already-set) --------------------------------------------

  it('returns already-set and skips update when registrationTenant is a number', async () => {
    mockPayload.auth.mockResolvedValue({ user: { id: 1, registrationTenant: 5 } })

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.reason).toBe('already-set')
    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  it('returns already-set when registrationTenant is a non-empty string id', async () => {
    mockPayload.auth.mockResolvedValue({ user: { id: 1, registrationTenant: '5' } })

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(body.reason).toBe('already-set')
    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  // --- Tenant assignment (the regression case) ------------------------------

  it('assigns registrationTenant and returns assigned when user has none', async () => {
    mockPayload.auth.mockResolvedValue({ user: { id: 1, registrationTenant: null } })
    ;(getTenantIdForCreateRequest as ReturnType<typeof vi.fn>).mockResolvedValue(7)

    const res = await POST(makeRequest({ host: 'studio.example.com' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.reason).toBe('assigned')
    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 1,
        data: { registrationTenant: 7 },
        overrideAccess: true,
      }),
    )
  })

  it('assigns registrationTenant when registrationTenant is undefined on the user', async () => {
    mockPayload.auth.mockResolvedValue({ user: { id: 2 } }) // registrationTenant not present
    ;(getTenantIdForCreateRequest as ReturnType<typeof vi.fn>).mockResolvedValue(9)

    const res = await POST(makeRequest({ host: 'gym.example.com' }))
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(body.reason).toBe('assigned')
    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { registrationTenant: 9 } }),
    )
  })

  it('passes request headers to getTenantIdForCreateRequest', async () => {
    mockPayload.auth.mockResolvedValue({ user: { id: 1, registrationTenant: null } })
    ;(getTenantIdForCreateRequest as ReturnType<typeof vi.fn>).mockResolvedValue(7)

    const headers = { host: 'studio.example.com', 'x-tenant-slug': 'studio' }
    await POST(makeRequest(headers))

    const [, source] = (getTenantIdForCreateRequest as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(source.headers.get('host')).toBe('studio.example.com')
  })

  // --- No tenant resolved ---------------------------------------------------

  it('returns no-tenant-resolved and skips update when no tenant maps to the host', async () => {
    mockPayload.auth.mockResolvedValue({ user: { id: 1, registrationTenant: null } })
    ;(getTenantIdForCreateRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('no-tenant-resolved')
    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  it('returns no-tenant-resolved when getTenantIdForCreateRequest returns empty string', async () => {
    mockPayload.auth.mockResolvedValue({ user: { id: 1, registrationTenant: null } })
    ;(getTenantIdForCreateRequest as ReturnType<typeof vi.fn>).mockResolvedValue('')

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(body.reason).toBe('no-tenant-resolved')
    expect(mockPayload.update).not.toHaveBeenCalled()
  })
})
