/**
 * Regression tests: a user who has `location-manager` on one tenant, `admin` on a
 * second tenant, and `user` on a third must be able to access the admin panel of the
 * tenant where they hold `location-manager`.
 *
 * Root cause of production bug: when a super-admin saves a user's per-tenant roles via
 * the Payload admin UI, the `beforeChange` hook previously returned early for super-admins
 * and skipped `deriveRoleFromTenants`. The user's global `role` field was left as `'user'`
 * even though their per-tenant roles included `admin` and `location-manager`. Because
 * `usersPayloadAdminAccess` and most access functions check the global `role` (from the JWT),
 * the user appeared unauthorised on every tenant admin panel.
 *
 * Fix: the derive-role step now runs for all authenticated saves (including super-admins)
 * whenever `tenants` data is present.
 */
import { test, expect } from './helpers/fixtures'
import { loginToAdminPanel } from './helpers/auth-helpers'
import { createTestUser, getPayloadInstance } from './helpers/data-helpers'

test.describe('Location-manager + admin cross-tenant admin access', () => {
  test.setTimeout(90_000)

  /**
   * Core access check: a user with location-manager on T1, admin on T2, user on T3
   * must be able to reach T1's admin panel (not get an unauthorised/forbidden redirect).
   */
  test('location-manager on T1 can access T1 admin panel when also admin on T2 and user on T3', async ({
    page,
    request,
    testData,
  }) => {
    const tenant1 = testData.tenants[0]!
    const tenant2 = testData.tenants[1]!
    const tenant3 = testData.tenants[2]!
    const stamp = Date.now()
    const payload = await getPayloadInstance()

    // Create the multi-role user with the stale global role 'user' to mirror the production
    // scenario: a super-admin set per-tenant roles via the admin UI but the global `role`
    // field was never updated (previously because deriveRoleFromTenants was skipped for
    // super-admin saves). overrideAccess:true bypasses hooks so the stale role is preserved.
    const multiRoleUser = await createTestUser(
      `locmgrcross${testData.workerIndex}${stamp}@test.com`,
      'password',
      'Cross Tenant Loc Manager',
      ['user'], // deliberately stale — the JWT will carry 'user' at login time
    )

    // Per-tenant roles are correct; only the global role is wrong.
    await payload.update({
      collection: 'users',
      id: multiRoleUser.id,
      data: {
        tenants: [
          { tenant: tenant1.id, roles: ['user', 'location-manager'] },
          { tenant: tenant2.id, roles: ['user', 'admin'] },
          { tenant: tenant3.id, roles: ['user'] },
        ],
        registrationTenant: tenant1.id,
        role: ['user'], // stale — authorize-tenant must use per-tenant roles as fallback
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })

    try {
      // Log in to T1's admin panel (tenant where user is location-manager, NOT admin).
      await loginToAdminPanel(page, multiRoleUser.email, 'password', {
        request,
        adminOrigin: `http://${tenant1.slug}.localhost:3000`,
      })

      // After login the middleware should redirect away from /admin/login to /admin.
      await page
        .waitForURL(
          (u) =>
            u.hostname === `${tenant1.slug}.localhost` &&
            u.pathname.startsWith('/admin') &&
            !u.pathname.startsWith('/admin/login'),
          { timeout: 25_000 },
        )
        .catch(() => null)

      const url = new URL(page.url())
      expect(
        url.hostname === `${tenant1.slug}.localhost` &&
          url.pathname.startsWith('/admin') &&
          !url.pathname.startsWith('/admin/login'),
        `Expected to land on ${tenant1.slug} admin panel, got: ${page.url()}`,
      ).toBe(true)
    } finally {
      await payload
        .delete({ collection: 'users', id: multiRoleUser.id, overrideAccess: true })
        .catch(() => null)
    }
  })

  /**
   * Complementary check: the same user can also reach T2's admin panel (where they are admin).
   * If this breaks while the T1 check passes it points to a role-derivation regression.
   */
  test('same user can also access T2 admin panel where they hold admin role', async ({
    page,
    request,
    testData,
  }) => {
    const tenant1 = testData.tenants[0]!
    const tenant2 = testData.tenants[1]!
    const tenant3 = testData.tenants[2]!
    const stamp = Date.now()
    const payload = await getPayloadInstance()

    const multiRoleUser = await createTestUser(
      `locmgrcross2${testData.workerIndex}${stamp}@test.com`,
      'password',
      'Cross Tenant Loc Manager 2',
      ['user'],
    )

    await payload.update({
      collection: 'users',
      id: multiRoleUser.id,
      data: {
        tenants: [
          { tenant: tenant1.id, roles: ['user', 'location-manager'] },
          { tenant: tenant2.id, roles: ['user', 'admin'] },
          { tenant: tenant3.id, roles: ['user'] },
        ],
        registrationTenant: tenant2.id,
        role: ['user'],
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })

    try {
      await loginToAdminPanel(page, multiRoleUser.email, 'password', {
        request,
        adminOrigin: `http://${tenant2.slug}.localhost:3000`,
      })

      await page
        .waitForURL(
          (u) =>
            u.hostname === `${tenant2.slug}.localhost` &&
            u.pathname.startsWith('/admin') &&
            !u.pathname.startsWith('/admin/login'),
          { timeout: 25_000 },
        )
        .catch(() => null)

      const url = new URL(page.url())
      expect(
        url.hostname === `${tenant2.slug}.localhost` &&
          url.pathname.startsWith('/admin') &&
          !url.pathname.startsWith('/admin/login'),
        `Expected to land on ${tenant2.slug} admin panel, got: ${page.url()}`,
      ).toBe(true)
    } finally {
      await payload
        .delete({ collection: 'users', id: multiRoleUser.id, overrideAccess: true })
        .catch(() => null)
    }
  })

  /**
   * Negative check: the user must NOT be able to access T3's admin panel (where they are
   * only 'user', with no elevated role).
   */
  test('user with only "user" role on T3 cannot access T3 admin panel', async ({
    page,
    request,
    testData,
  }) => {
    const tenant1 = testData.tenants[0]!
    const tenant2 = testData.tenants[1]!
    const tenant3 = testData.tenants[2]!
    const stamp = Date.now()
    const payload = await getPayloadInstance()

    const multiRoleUser = await createTestUser(
      `locmgrcross3${testData.workerIndex}${stamp}@test.com`,
      'password',
      'Cross Tenant Loc Manager 3',
      ['user'],
    )

    await payload.update({
      collection: 'users',
      id: multiRoleUser.id,
      data: {
        tenants: [
          { tenant: tenant1.id, roles: ['user', 'location-manager'] },
          { tenant: tenant2.id, roles: ['user', 'admin'] },
          { tenant: tenant3.id, roles: ['user'] },
        ],
        registrationTenant: tenant1.id,
        role: ['user'],
      } as Parameters<typeof payload.update>[0]['data'],
      overrideAccess: true,
    })

    try {
      await loginToAdminPanel(page, multiRoleUser.email, 'password', {
        request,
        adminOrigin: `http://${tenant3.slug}.localhost:3000`,
      })

      // Allow navigation to settle.
      await page.waitForTimeout(3000)

      const url = new URL(page.url())
      // The user should be blocked — they should NOT land on the admin dashboard for T3.
      // Acceptable outcomes: on /admin/login, on /admin/unauthorized (Payload's own access
      // control), or redirected away from T3 entirely.
      const blockedFromT3AdminDashboard =
        url.pathname.startsWith('/admin/login') ||
        url.pathname.startsWith('/admin/unauthorized') ||
        url.hostname !== `${tenant3.slug}.localhost` ||
        !url.pathname.startsWith('/admin')

      expect(
        blockedFromT3AdminDashboard,
        `Expected user to be blocked from T3 admin panel, got: ${page.url()}`,
      ).toBe(true)
    } finally {
      await payload
        .delete({ collection: 'users', id: multiRoleUser.id, overrideAccess: true })
        .catch(() => null)
    }
  })
})
