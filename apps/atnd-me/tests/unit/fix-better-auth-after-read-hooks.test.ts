import { describe, expect, it } from 'vitest'

import { fixBetterAuthAfterReadHooks } from '../../src/plugins/fix-better-auth-after-read-hooks'
import { ATND_READ_ALL_MEMBERSHIPS } from '../../src/lib/users/attachUserToTenant'

const tenantAdmin = { id: 2, tenants: [{ tenant: 7, roles: ['admin'] }] }

describe('fixBetterAuthAfterReadHooks membership filter', () => {
  it('keeps every membership when the stored-membership read sets the skip flag', async () => {
    const plugin = fixBetterAuthAfterReadHooks()
    const config = plugin({
      collections: [{ slug: 'users', fields: [], hooks: {} }],
    } as never)
    const afterRead =
      config.collections?.find((c) => c.slug === 'users')?.hooks?.afterRead ?? []
    const doc = {
      id: 9,
      tenants: [
        { tenant: 7, roles: ['user'] },
        { tenant: 6, roles: ['user'] },
      ],
    }

    const kept = await afterRead[0]!({
      doc,
      req: {
        user: tenantAdmin,
        context: { [ATND_READ_ALL_MEMBERSHIPS]: true },
        payload: {},
      },
    } as never)
    expect(kept).toEqual(doc)

    const filtered = await afterRead[0]!({
      doc,
      req: { user: tenantAdmin, context: {}, payload: {} },
    } as never)
    expect((filtered as { tenants: unknown[] }).tenants).toEqual([{ tenant: 7, roles: ['user'] }])
  })
})
