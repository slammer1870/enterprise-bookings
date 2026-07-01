/**
 * Privacy isolation tests for the tenants[n].roles consolidation.
 *
 * These tests verify that:
 * 1. A tenant admin's API response omits other tenants' entries from a shared user's `tenants` array.
 * 2. A tenant admin cannot overwrite foreign tenant roles via the API.
 * 3. The `role` field is hidden from tenant admin API responses (super-admin only).
 *
 * All three tests are expected to FAIL until the schema consolidation (Step 6) is applied —
 * specifically, until the afterRead hook filters `tenants` and the fixBetterAuthRoleField
 * plugin restricts `role` read access to super-admins only.
 */
import { test, expect } from './helpers/fixtures'
import {
  createTestEventType,
  createTestTimeslot,
  createTestBooking,
  getPayloadInstance,
} from './helpers/data-helpers'

async function loginViaPayloadApi(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  email: string,
  password: string,
): Promise<string> {
  const res = await request.post('http://localhost:3000/api/users/login', {
    data: { email, password },
    failOnStatusCode: false,
  })
  expect(res.ok()).toBe(true)
  const body = (await res.json()) as { token?: string }
  expect(body.token).toBeTruthy()
  return body.token!
}

test.describe('Tenant roles privacy isolation', () => {
  test('tenant admin API response omits other tenants entries from tenants array', async ({
    request,
    testData,
  }) => {
    const tenant1 = testData.tenants[0]!
    const tenant2 = testData.tenants[1]!
    const user2 = testData.users.user2 // registered at tenant2
    const workerIndex = testData.workerIndex

    // Make user2 visible to tenantAdmin1 by creating a booking at tenant1
    const eventType = await createTestEventType(
      tenant1.id,
      'Privacy Isolation Test',
      10,
      undefined,
      workerIndex,
    )
    const startTime = new Date(Date.now() + 72 * 60 * 60 * 1000)
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)
    const timeslot = await createTestTimeslot(tenant1.id, eventType.id, startTime, endTime)
    await createTestBooking(user2.id, timeslot.id, 'confirmed')

    const token = await loginViaPayloadApi(request, testData.users.tenantAdmin1.email, 'password')

    const res = await request.get(`http://localhost:3000/api/users/${user2.id}`, {
      headers: { Authorization: `JWT ${token}` },
      failOnStatusCode: false,
    })
    expect(res.ok()).toBe(true)
    const body = (await res.json()) as { doc?: { tenants?: Array<{ tenant: unknown }> } }

    // tenantAdmin1 (scoped to tenant1) must not see user2's tenant2 membership
    const tenantIds = (body.doc?.tenants ?? []).map((e) => {
      const t = e.tenant
      return typeof t === 'object' && t !== null && 'id' in t ? (t as { id: number }).id : t
    })
    expect(tenantIds).not.toContain(tenant2.id)
  })

  test('tenant admin cannot overwrite foreign tenant roles via API', async ({
    request,
    testData,
  }) => {
    const tenant1 = testData.tenants[0]!
    const tenant2 = testData.tenants[1]!
    const user2 = testData.users.user2 // registered at tenant2

    const token = await loginViaPayloadApi(request, testData.users.tenantAdmin1.email, 'password')

    // tenantAdmin1 tries to grant tenant2 admin role to user2 via direct tenants write
    await request.patch(`http://localhost:3000/api/users/${user2.id}`, {
      data: { tenants: [{ tenant: tenant2.id, roles: ['admin'] }] },
      headers: { Authorization: `JWT ${token}` },
      failOnStatusCode: false,
    })

    // Verify via super-admin that tenant2 roles were NOT changed to admin
    const payload = await getPayloadInstance()
    const updated = await payload.findByID({
      collection: 'users',
      id: user2.id,
      depth: 0,
      overrideAccess: true,
    })

    const updatedTenants = Array.isArray(updated.tenants)
      ? (updated.tenants as Array<{ tenant: unknown; roles?: unknown[] }>)
      : []

    const t2Entry = updatedTenants.find((e) => {
      const t = e.tenant
      const id = typeof t === 'object' && t !== null && 'id' in t ? (t as { id: number }).id : t
      return id === tenant2.id
    })

    // The foreign tenant's roles should not have been escalated to admin.
    // If t2Entry is absent (no join-table row for tenant2), the invariant is trivially satisfied.
    expect(t2Entry?.roles ?? []).not.toContain('admin')
  })

  test('role field is absent from tenant admin API response for another user', async ({
    request,
    testData,
  }) => {
    const token = await loginViaPayloadApi(request, testData.users.tenantAdmin1.email, 'password')

    const res = await request.get(
      `http://localhost:3000/api/users/${testData.users.user1.id}`,
      {
        headers: { Authorization: `JWT ${token}` },
        failOnStatusCode: false,
      },
    )
    expect(res.ok()).toBe(true)
    const body = (await res.json()) as { doc?: Record<string, unknown> }

    // After fixBetterAuthRoleField restricts `role` read to super-admin only,
    // tenant admins should not receive the role field in API responses.
    expect(body.doc?.role).toBeUndefined()
  })
})
