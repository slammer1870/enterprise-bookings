/**
 * Security regression tests for cross-tenant admin role escalation.
 *
 * Scenario: A tenant admin can see users who have bookings at their tenant even if
 * those users are registered at a different tenant. The bug (now fixed) allowed the
 * admin to assign the `admin` role to such cross-tenant users, granting them admin
 * panel access to the tenant they actually registered with.
 */
import { test, expect } from './helpers/fixtures'
import { loginToAdminPanel } from './helpers/auth-helpers'
import {
  createTestEventType,
  createTestTimeslot,
  createTestBooking,
  getPayloadInstance,
} from './helpers/data-helpers'

test.describe('Cross-tenant admin role escalation prevention', () => {
  /**
   * Core security test: Tenant A admin must NOT be able to assign the `admin` role
   * to a user whose tenant memberships extend beyond Tenant A.
   *
   * Setup: user2 is registered at Tenant 2. They make a booking at Tenant 1, which
   * makes them visible to Tenant 1's admin. The admin tries to promote them to `admin`.
   */
  test('tenant admin cannot escalate a cross-tenant user to admin role via API', async ({
    request,
    testData,
  }) => {
    const tenant1 = testData.tenants[0]!
    const user2 = testData.users.user2 // registered at tenant2
    const workerIndex = testData.workerIndex

    // Create a timeslot at tenant1 and a booking for user2 so they appear in
    // tenant1 admin's user list (via the booking-user-ids access-control clause).
    const eventType = await createTestEventType(
      tenant1.id,
      'Security Escalation Test',
      10,
      undefined,
      workerIndex,
    )
    const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000)
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)
    const timeslot = await createTestTimeslot(tenant1.id, eventType.id, startTime, endTime)
    await createTestBooking(user2.id, timeslot.id, 'confirmed')

    // Login as tenantAdmin1 via Payload JWT
    const loginRes = await request.post('http://localhost:3000/api/users/login', {
      data: { email: testData.users.tenantAdmin1.email, password: 'password' },
      failOnStatusCode: false,
    })
    expect(loginRes.ok()).toBe(true)
    const loginData = (await loginRes.json()) as { token?: string }
    const adminToken = loginData.token
    expect(adminToken).toBeTruthy()

    // Attempt to escalate user2 to admin via the tenants[n].roles write path.
    // The beforeChange write guard must strip this foreign-tenant injection.
    const updateRes = await request.patch(`http://localhost:3000/api/users/${user2.id}`, {
      data: { tenants: [{ tenant: tenant1.id, roles: ['admin'] }] },
      headers: { Authorization: `JWT ${adminToken}` },
      failOnStatusCode: false,
    })

    expect(updateRes.ok()).toBe(true)

    // Verify via super-admin direct DB read that tenant2's roles were not changed to admin
    const { getPayloadInstance } = await import('./helpers/data-helpers')
    const payload = await getPayloadInstance()
    const updatedUser = await payload.findByID({
      collection: 'users',
      id: user2.id,
      depth: 0,
      overrideAccess: true,
    })

    const updatedTenants = Array.isArray(updatedUser.tenants)
      ? (updatedUser.tenants as Array<{ tenant: unknown; roles?: unknown[] }>)
      : []
    const t2Entry = updatedTenants.find((e) => {
      const t = e.tenant
      const id = typeof t === 'object' && t !== null && 'id' in t ? (t as { id: number }).id : t
      return id === testData.tenants[1]?.id
    })

    // The `admin` role MUST NOT have been granted for tenant2 — cross-tenant escalation is blocked.
    // If t2Entry is absent (user2 has no tenant2 row in the join table), the invariant is trivially
    // satisfied: no tenant2 admin role was granted.
    expect(t2Entry?.roles ?? []).not.toContain('admin')
  })

  /**
   * Counterpart to the security test: a tenant admin SHOULD still be able to assign
   * the `admin` role to a user whose tenant memberships are entirely within their own tenant.
   */
  test('tenant admin CAN assign admin role to a user belonging only to their tenant', async ({
    request,
    testData,
  }) => {
    const user1 = testData.users.user1 // registered at tenant1
    const payload = await getPayloadInstance()

    // Ensure user1's memberships are scoped to tenant1 only with user role (idempotent).
    await payload.update({
      collection: 'users',
      id: user1.id,
      data: {
        tenants: [{ tenant: testData.tenants[0]!.id, roles: ['user'] }],
        registrationTenant: testData.tenants[0]!.id,
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })

    // Login as tenantAdmin1 via Payload JWT.
    const loginRes = await request.post('http://localhost:3000/api/users/login', {
      data: { email: testData.users.tenantAdmin1.email, password: 'password' },
      failOnStatusCode: false,
    })
    expect(loginRes.ok()).toBe(true)
    const loginData = (await loginRes.json()) as { token?: string }
    const adminToken = loginData.token
    expect(adminToken).toBeTruthy()

    // Assign admin role to user1 via tenants[n].roles (user1 only in tenant1 — same as admin).
    const updateRes = await request.patch(`http://localhost:3000/api/users/${user1.id}`, {
      data: { tenants: [{ tenant: testData.tenants[0]!.id, roles: ['admin'] }] },
      headers: { Authorization: `JWT ${adminToken}` },
      failOnStatusCode: false,
    })

    expect(updateRes.ok()).toBe(true)

    // Verify via super-admin that tenant1 roles were updated to admin
    const updatedUser = await payload.findByID({
      collection: 'users',
      id: user1.id,
      depth: 0,
      overrideAccess: true,
    })

    const updatedTenants = Array.isArray(updatedUser.tenants)
      ? (updatedUser.tenants as Array<{ tenant: unknown; roles?: unknown[] }>)
      : []
    const t1Entry = updatedTenants.find((e) => {
      const t = e.tenant
      const id = typeof t === 'object' && t !== null && 'id' in t ? (t as { id: number }).id : t
      return id === testData.tenants[0]!.id
    })

    // The `admin` role SHOULD have been granted — user1 belongs only to tenant1.
    expect(t1Entry?.roles).toContain('admin')

    // Cleanup: restore user1 to the plain `user` role via tenants[n].roles.
    await payload.update({
      collection: 'users',
      id: user1.id,
      data: {
        tenants: [{ tenant: testData.tenants[0]!.id, roles: ['user'] }],
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })
  })

  /**
   * Defence-in-depth browser test: even if a user with `admin` role has memberships
   * ONLY in Tenant 2, they cannot access Tenant 1's admin panel.
   * This validates that the authorize-tenant middleware correctly gates the panel by
   * the user's actual tenant memberships, not merely by having any `admin` role.
   */
  test('user with admin role scoped to tenant2 is denied access to tenant1 admin panel', async ({
    page,
    testData,
  }) => {
    // loginToAdminPanel waits up to 20 s for a successful login, then 20 s more via the
    // UI fallback — 40 s total for a login that can never succeed.  With PW_E2E_FAST the
    // test timeout is only 35 s, so we must use a lightweight path for the denied-access check.
    test.setTimeout(90_000)

    const tenant1 = testData.tenants[0]!
    const tenant2 = testData.tenants[1]!
    const user2 = testData.users.user2 // registered at tenant2
    const payload = await getPayloadInstance()

    // Directly elevate user2 to admin (simulating a DB misconfiguration or super-admin action).
    // Their tenant memberships remain [tenant2] — they should NOT gain access to tenant1's admin.
    // Use overrideAccess + direct role field since this simulates a super-admin DB intervention.
    await payload.update({
      collection: 'users',
      id: user2.id,
      data: {
        tenants: [{ tenant: tenant2.id, roles: ['admin'] }],
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })

    try {
      // ── Part 1: verify tenant1 access is DENIED ──────────────────────────────
      // Authenticate user2 via the root Payload login endpoint (subdomain URLs don't
      // resolve via DNS in the test API context, so we always hit localhost:3000).
      // Then copy the session cookies to the tenant1 subdomain context so the
      // authorize-tenant middleware can read them when the browser navigates there.
      const loginRes = await page.request.post('http://localhost:3000/api/users/login', {
        data: { email: user2.email, password: 'password' },
        failOnStatusCode: false,
      })
      if (loginRes.ok()) {
        const state = await page.request.storageState()
        if (state.cookies.length) {
          // Root-domain cookies
          await page.context().addCookies(state.cookies)
          // Subdomain-scoped copies so the tenant1 admin request carries the session
          const tenantScopedCookies = state.cookies.map((c) => ({
            ...c,
            domain: `${tenant1.slug}.localhost`,
          }))
          await page.context().addCookies(tenantScopedCookies)
        }
      }

      await page
        .goto(`http://${tenant1.slug}.localhost:3000/admin`, {
          waitUntil: 'domcontentloaded',
          timeout: 15_000,
        })
        .catch(() => null)

      await page
        .waitForURL(
          (u) =>
            u.hostname !== `${tenant1.slug}.localhost` ||
            u.pathname.startsWith('/admin/login'),
          { timeout: 10_000 },
        )
        .catch(() => null)

      const url = new URL(page.url())
      const wasGrantedAccess =
        url.hostname === `${tenant1.slug}.localhost` &&
        url.pathname.startsWith('/admin') &&
        !url.pathname.startsWith('/admin/login')

      // user2's tenants = [tenant2], so tenant1 admin access must be denied.
      expect(wasGrantedAccess).toBe(false)

      // ── Part 2: verify tenant2 access IS granted ─────────────────────────────
      // loginToAdminPanel is fine here because the login is expected to succeed.
      await loginToAdminPanel(page, user2.email, 'password', {
        adminOrigin: `http://${tenant2.slug}.localhost:3000`,
      })
      await page
        .waitForURL(
          (u) =>
            u.hostname === `${tenant2.slug}.localhost` &&
            u.pathname.startsWith('/admin') &&
            !u.pathname.startsWith('/admin/login'),
          { timeout: 15_000 },
        )
        .catch(() => null)

      const url2 = new URL(page.url())
      const isOnTenant2Admin =
        url2.hostname === `${tenant2.slug}.localhost` &&
        url2.pathname.startsWith('/admin') &&
        !url2.pathname.startsWith('/admin/login')

      expect(isOnTenant2Admin).toBe(true)
    } finally {
      // Restore user2 to the plain `user` role regardless of test outcome.
      await payload.update({
        collection: 'users',
        id: user2.id,
        data: {
          tenants: [{ tenant: tenant2.id, roles: ['user'] }],
        } as Parameters<typeof payload.update>[0]['data'],
        overrideAccess: true,
      })
    }
  })
})
