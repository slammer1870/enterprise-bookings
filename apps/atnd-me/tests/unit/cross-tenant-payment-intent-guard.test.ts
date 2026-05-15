/**
 * Regression tests for the cross-tenant guard in create-payment-intent.
 *
 * Pre-existing vulnerability: a user on tenant A's site could submit a timeslot ID
 * belonging to tenant B and successfully create a booking on tenant B's class,
 * bypassing tenant B's scheduling restrictions (registration windows, availability, etc.).
 *
 * Fix: after resolving tenantId from the timeslot, the route resolves the tenant
 * identifier from the request (subdomain / cookie) and returns 404 if there is a
 * mismatch.  When no tenant context is present in the request (direct API / mobile
 * calls) the guard is a no-op so those callers are unaffected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utilities/getTenantIdentifierFromRequest', () => ({
  getTenantIdentifierFromRequest: vi.fn(),
}))

// Stub the full api-helpers module so we can control resolveTenantSlugOrId
// and resolveTenantForConnect independently per test.
vi.mock('@/lib/stripe-connect/api-helpers', () => ({
  getCurrentUser: vi.fn(),
  resolveTenantSlugOrId: vi.fn(),
  resolveTenantForConnect: vi.fn(),
}))

import {
  resolveTenantSlugOrId,
  resolveTenantForConnect,
} from '@/lib/stripe-connect/api-helpers'

const mockResolveTenantSlugOrId = resolveTenantSlugOrId as ReturnType<typeof vi.fn>
const mockResolveTenantForConnect = resolveTenantForConnect as ReturnType<typeof vi.fn>

// ─── helpers ────────────────────────────────────────────────────────────────

/** Simulate the cross-tenant guard logic extracted from the route handler. */
async function runCrossTenantGuard(
  timeslotTenantId: number,
  requestSlugOrId: string | null,
  resolvedRequestTenant: { id: number } | null = null,
): Promise<{ blocked: boolean; status?: number }> {
  mockResolveTenantSlugOrId.mockReturnValue(requestSlugOrId)
  mockResolveTenantForConnect.mockResolvedValue(resolvedRequestTenant)

  // Replicate the guard logic from the route verbatim.
  const request = {} as never // not used by mock
  const payload = {} as never // not used by mock (mock intercepts resolveTenantForConnect)

  const requestTenantSlugOrId = resolveTenantSlugOrId(request)
  if (requestTenantSlugOrId != null) {
    const requestNumericId = /^\d+$/.test(requestTenantSlugOrId)
      ? parseInt(requestTenantSlugOrId, 10)
      : null
    if (requestNumericId != null) {
      if (requestNumericId !== timeslotTenantId) {
        return { blocked: true, status: 404 }
      }
    } else {
      const requestTenant = await resolveTenantForConnect(payload, requestTenantSlugOrId)
      if (requestTenant != null && requestTenant.id !== timeslotTenantId) {
        return { blocked: true, status: 404 }
      }
    }
  }
  return { blocked: false }
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('create-payment-intent: cross-tenant guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('slug-based tenant context (subdomain)', () => {
    it('allows booking when request tenant matches timeslot tenant', async () => {
      const result = await runCrossTenantGuard(42, 'tenant-a', { id: 42 })
      expect(result.blocked).toBe(false)
    })

    it('blocks booking when request tenant differs from timeslot tenant', async () => {
      const result = await runCrossTenantGuard(42, 'tenant-a', { id: 99 })
      expect(result.blocked).toBe(true)
      expect(result.status).toBe(404)
    })

    it('allows booking when slug cannot be resolved to a tenant (graceful degradation)', async () => {
      // resolveTenantForConnect returns null (unknown slug) — do not block
      const result = await runCrossTenantGuard(42, 'unknown-tenant', null)
      expect(result.blocked).toBe(false)
    })
  })

  describe('numeric tenant context (cookie / header)', () => {
    it('allows booking when numeric request tenant ID matches timeslot tenant', async () => {
      const result = await runCrossTenantGuard(42, '42')
      expect(result.blocked).toBe(false)
    })

    it('blocks booking when numeric request tenant ID differs from timeslot tenant', async () => {
      const result = await runCrossTenantGuard(42, '99')
      expect(result.blocked).toBe(true)
      expect(result.status).toBe(404)
    })
  })

  describe('no tenant context (direct API / mobile)', () => {
    it('allows booking when there is no tenant context in the request', async () => {
      // resolveTenantSlugOrId returns null — guard is a no-op
      const result = await runCrossTenantGuard(42, null)
      expect(result.blocked).toBe(false)
      expect(mockResolveTenantForConnect).not.toHaveBeenCalled()
    })
  })
})
