import { describe, it, expect } from 'vitest'
import { schedulerAdminAccess } from '@/access/schedulerAccess'

describe('schedulerAdminAccess', () => {
  it('allows org admin and location-manager', async () => {
    await expect(
      schedulerAdminAccess({
        req: {
          user: { id: 1, tenants: [{ tenant: 7, roles: ['admin'] }] },
          payload: {},
        },
      } as any),
    ).resolves.toBe(true)
    await expect(
      schedulerAdminAccess({
        req: {
          user: { id: 1, tenants: [{ tenant: 7, roles: ['location-manager'] }] },
          payload: {},
        },
      } as any),
    ).resolves.toBe(true)
  })

  it('denies staff-only and unauthenticated', async () => {
    await expect(
      schedulerAdminAccess({
        req: {
          user: { id: 1, tenants: [{ tenant: 7, roles: ['staff'] }] },
          payload: {},
        },
      } as any),
    ).resolves.toBe(false)
    await expect(
      schedulerAdminAccess({ req: { user: null, payload: {} } } as any),
    ).resolves.toBe(false)
  })

  it('allows platform super-admin', async () => {
    await expect(
      schedulerAdminAccess({
        req: { user: { id: 1, role: ['super-admin'] }, payload: {} },
      } as any),
    ).resolves.toBe(true)
  })
})
