/**
 * Regression tests for multi-tenant role preservation.
 *
 * Bug: A user who is `admin` of Tenant A and `location-manager` of Tenant B had their
 * global `role` downgraded to `['user']` on every save. The cross-tenant escalation guard
 * in the `beforeChange` hook was treating role *preservation* as *escalation*: because
 * `'admin'` is a CROSS_TENANT_BLOCKED_ROLE and the user has a Tenant B membership outside
 * the granting admin's scope, it unconditionally stripped `'admin'` from `d.role`.
 *
 * The fix: only apply the cross-tenant membership check when the elevated role is being
 * *newly granted* (not already present on the target user).
 */
import { test, expect } from './helpers/fixtures'
import { loginToAdminPanel } from './helpers/auth-helpers'
import { createTestUser, getPayloadInstance } from './helpers/data-helpers'

test.describe('Multi-tenant role preservation (admin + location-manager)', () => {
  /**
   * Core API regression: when a tenant admin makes any update to a user who already holds
   * `admin` in their tenant AND `location-manager` in another tenant, the global `role`
   * must NOT be downgraded to `['user']`.
   */
  test('updating a dual-tenant user preserves their global admin role', async ({
    request,
    testData,
  }) => {
    const tenant1 = testData.tenants[0]!
    const tenant2 = testData.tenants[1]!
    const stamp = Date.now()
    const payload = await getPayloadInstance()

    // Create a user with admin of T1 and location-manager of T2.
    // Use overrideAccess so deriveRoleFromTenants in the hooks sets global role correctly.
    const dualUser = await createTestUser(
      `dual${testData.workerIndex}${stamp}@test.com`,
      'password',
      'Dual Role User',
      ['admin'],
    )
    await payload.update({
      collection: 'users',
      id: dualUser.id,
      data: {
        tenants: [
          { tenant: tenant1.id, roles: ['admin'] },
          { tenant: tenant2.id, roles: ['location-manager'] },
        ],
        registrationTenant: tenant1.id,
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })

    try {
      // Login as Tenant 1 admin.
      const loginRes = await request.post('http://localhost:3000/api/users/login', {
        data: { email: testData.users.tenantAdmin1.email, password: 'password' },
        failOnStatusCode: false,
      })
      expect(loginRes.ok()).toBe(true)
      const { token: adminToken } = (await loginRes.json()) as { token?: string }
      expect(adminToken).toBeTruthy()

      // Simulate a routine update that includes the role field — this was the regression
      // trigger. The T1 admin is not changing the role, just preserving it as ['admin'].
      const updateRes = await request.patch(`http://localhost:3000/api/users/${dualUser.id}`, {
        data: { role: ['admin'] },
        headers: { Authorization: `JWT ${adminToken}` },
        failOnStatusCode: false,
      })
      expect(updateRes.ok()).toBe(true)

      // Read the user back and verify the global role was NOT downgraded.
      const after = await payload.findByID({
        collection: 'users',
        id: dualUser.id,
        depth: 0,
        overrideAccess: true,
      })

      const effectiveRole = Array.isArray(after.role)
        ? (after.role as string[])
        : after.role
          ? [String(after.role)]
          : []

      // Before the fix this assertion would fail: effectiveRole would be ['user'].
      expect(effectiveRole).toContain('admin')
      expect(effectiveRole).not.toContain('user')
    } finally {
      await payload.delete({ collection: 'users', id: dualUser.id, overrideAccess: true }).catch(() => null)
    }
  })

  /**
   * Browser regression: after a T1 admin updates the dual-tenant user, they can still
   * access BOTH tenant admin panels. Before the fix, the role downgrade to 'user' meant
   * subsequent collection operations returned 403 inside the admin UI.
   */
  test('dual-tenant user can access both tenant admin panels after a role-preserving update', async ({
    page,
    request,
    testData,
  }) => {
    test.setTimeout(90_000)

    const tenant1 = testData.tenants[0]!
    const tenant2 = testData.tenants[1]!
    const stamp = Date.now()
    const payload = await getPayloadInstance()

    const dualUser = await createTestUser(
      `dualbrowser${testData.workerIndex}${stamp}@test.com`,
      'password',
      'Dual Role Browser User',
      ['admin'],
    )
    await payload.update({
      collection: 'users',
      id: dualUser.id,
      data: {
        tenants: [
          { tenant: tenant1.id, roles: ['admin'] },
          { tenant: tenant2.id, roles: ['location-manager'] },
        ],
        registrationTenant: tenant1.id,
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })

    try {
      // Trigger the update that previously caused the regression.
      const loginRes = await request.post('http://localhost:3000/api/users/login', {
        data: { email: testData.users.tenantAdmin1.email, password: 'password' },
        failOnStatusCode: false,
      })
      const { token: adminToken } = (await loginRes.json()) as { token?: string }
      await request.patch(`http://localhost:3000/api/users/${dualUser.id}`, {
        data: { role: ['admin'] },
        headers: { Authorization: `JWT ${adminToken}` },
        failOnStatusCode: false,
      })

      // ── Verify access to Tenant 1's admin panel ──────────────────────────────
      await loginToAdminPanel(page, dualUser.email, 'password', {
        request,
        adminOrigin: `http://${tenant1.slug}.localhost:3000`,
      })
      await page
        .waitForURL(
          (u) =>
            u.hostname === `${tenant1.slug}.localhost` &&
            u.pathname.startsWith('/admin') &&
            !u.pathname.startsWith('/admin/login'),
          { timeout: 20_000 },
        )
        .catch(() => null)

      const t1Url = new URL(page.url())
      expect(
        t1Url.hostname === `${tenant1.slug}.localhost` &&
          t1Url.pathname.startsWith('/admin') &&
          !t1Url.pathname.startsWith('/admin/login'),
        `Expected to be on Tenant 1 admin panel, got: ${page.url()}`,
      ).toBe(true)

      // ── Verify access to Tenant 2's admin panel ──────────────────────────────
      await page.context().clearCookies()

      await loginToAdminPanel(page, dualUser.email, 'password', {
        request,
        adminOrigin: `http://${tenant2.slug}.localhost:3000`,
      })
      await page
        .waitForURL(
          (u) =>
            u.hostname === `${tenant2.slug}.localhost` &&
            u.pathname.startsWith('/admin') &&
            !u.pathname.startsWith('/admin/login'),
          { timeout: 20_000 },
        )
        .catch(() => null)

      const t2Url = new URL(page.url())
      expect(
        t2Url.hostname === `${tenant2.slug}.localhost` &&
          t2Url.pathname.startsWith('/admin') &&
          !t2Url.pathname.startsWith('/admin/login'),
        `Expected to be on Tenant 2 admin panel, got: ${page.url()}`,
      ).toBe(true)
    } finally {
      await payload.delete({ collection: 'users', id: dualUser.id, overrideAccess: true }).catch(() => null)
    }
  })

  /**
   * Guard still works: the fix must NOT disable the cross-tenant NEW role escalation guard.
   * A T1 admin must still be blocked from promoting a user (currently 'user' role) to 'admin'
   * when that user also has membership in Tenant 2.
   */
  test('cross-tenant escalation of a new elevated role is still blocked', async ({
    request,
    testData,
  }) => {
    const tenant1 = testData.tenants[0]!
    const tenant2 = testData.tenants[1]!
    const stamp = Date.now()
    const payload = await getPayloadInstance()

    // User is a plain member of both tenants — NOT yet an admin anywhere.
    const crossUser = await createTestUser(
      `crossguard${testData.workerIndex}${stamp}@test.com`,
      'password',
      'Cross Guard User',
      ['user'],
    )
    await payload.update({
      collection: 'users',
      id: crossUser.id,
      data: {
        tenants: [
          { tenant: tenant1.id, roles: ['user'] },
          { tenant: tenant2.id, roles: ['user'] },
        ],
        registrationTenant: tenant1.id,
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })

    try {
      // Login as Tenant 1 admin.
      const loginRes = await request.post('http://localhost:3000/api/users/login', {
        data: { email: testData.users.tenantAdmin1.email, password: 'password' },
        failOnStatusCode: false,
      })
      expect(loginRes.ok()).toBe(true)
      const { token: adminToken } = (await loginRes.json()) as { token?: string }

      // T1 admin tries to escalate the cross-tenant user to 'admin'.
      // 'admin' is NOT already on this user → isActualEscalation = true → guard fires.
      await request.patch(`http://localhost:3000/api/users/${crossUser.id}`, {
        data: { role: ['admin'] },
        headers: { Authorization: `JWT ${adminToken}` },
        failOnStatusCode: false,
      })

      const after = await payload.findByID({
        collection: 'users',
        id: crossUser.id,
        depth: 0,
        overrideAccess: true,
      })

      const effectiveRole = Array.isArray(after.role)
        ? (after.role as string[])
        : after.role
          ? [String(after.role)]
          : []

      // Guard must still block: cross-tenant user with a NEW admin grant must be denied.
      expect(effectiveRole).not.toContain('admin')
    } finally {
      await payload.delete({ collection: 'users', id: crossUser.id, overrideAccess: true }).catch(() => null)
    }
  })
})
