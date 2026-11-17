import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utilities/resolveTenantIdForDocumentWrite', () => ({
  resolveTenantIdForDocumentWrite: vi.fn(async () => null),
}))

vi.mock('@/utilities/getTenantContext', () => ({
  getTenantIdForCreateRequest: vi.fn(async () => null),
}))

import { ensureCreateTenantScope } from '../../src/collections/Users/ensureCreateTenantScope'
import { resolveTenantIdForDocumentWrite } from '@/utilities/resolveTenantIdForDocumentWrite'
import { getTenantIdForCreateRequest } from '@/utilities/getTenantContext'

describe('ensureCreateTenantScope (admin user create)', () => {
  beforeEach(() => {
    vi.mocked(resolveTenantIdForDocumentWrite).mockReset()
    vi.mocked(resolveTenantIdForDocumentWrite).mockResolvedValue(null)
    vi.mocked(getTenantIdForCreateRequest).mockReset()
    vi.mocked(getTenantIdForCreateRequest).mockResolvedValue(null)
  })

  it('stamps registrationTenant from the creator membership and does not invent a tenants[] row', async () => {
    // Org-admin sessions often keep tenants[n].roles but omit/strip derived global `role`.
    const admin = {
      id: 9,
      // no global role
      tenants: [{ tenant: 42, roles: ['admin'] }],
    }

    const data = await ensureCreateTenantScope({
      data: { email: 'new@example.com', name: 'New' },
      req: { user: admin, context: {}, payload: { findByID: vi.fn() } },
    })

    expect(data.registrationTenant).toBe(42)
    expect(data.tenants).toBeUndefined()
  })

  it('stamps registrationTenant from req.context.tenant when membership is empty (super-admin + selector context)', async () => {
    const data = await ensureCreateTenantScope({
      data: { email: 'new@example.com', name: 'New' },
      req: {
        user: { id: 1, role: ['super-admin'] },
        context: { tenant: 77 },
        payload: { findByID: vi.fn() },
      },
    })

    expect(data.registrationTenant).toBe(77)
    expect(data.tenants).toBeUndefined()
  })

  it('does not duplicate tenants[] when membership for the tenant already exists', async () => {
    const data = await ensureCreateTenantScope({
      data: {
        email: 'new@example.com',
        registrationTenant: 42,
        tenants: [{ tenant: 42, roles: ['staff'] }],
      },
      req: {
        user: { id: 9, tenants: [{ tenant: 42, roles: ['admin'] }] },
        context: {},
        payload: { findByID: vi.fn() },
      },
    })

    expect(data.tenants).toEqual([{ tenant: 42, roles: ['staff'] }])
  })

  it('falls back to TenantSelector cookie when membership and context are empty', async () => {
    vi.mocked(resolveTenantIdForDocumentWrite).mockResolvedValue(88)

    const data = await ensureCreateTenantScope({
      data: { email: 'new@example.com' },
      req: {
        user: { id: 1, role: ['super-admin'] },
        context: {},
        payload: { findByID: vi.fn() },
      },
    })

    expect(data.registrationTenant).toBe(88)
    expect(data.tenants).toBeUndefined()
  })

  it('location-manager: stamps registrationTenant only (cannot write tenants[].roles)', async () => {
    const data = await ensureCreateTenantScope({
      data: { email: 'new@example.com' },
      req: {
        user: {
          id: 3,
          tenants: [{ tenant: 42, roles: ['location-manager'] }],
        },
        context: {},
        payload: { findByID: vi.fn() },
      },
    })

    expect(data.registrationTenant).toBe(42)
    expect(data.tenants).toBeUndefined()
  })

  it('staff: stamps registrationTenant from their only membership', async () => {
    const data = await ensureCreateTenantScope({
      data: { email: 'new@example.com' },
      req: {
        user: {
          id: 4,
          tenants: [{ tenant: 42, roles: ['staff'] }],
        },
        context: {},
        payload: { findByID: vi.fn() },
      },
    })

    expect(data.registrationTenant).toBe(42)
    expect(data.tenants).toBeUndefined()
  })

  it('uses the TenantSelector cookie instead of the first membership', async () => {
    vi.mocked(resolveTenantIdForDocumentWrite).mockResolvedValue(77)

    const data = await ensureCreateTenantScope({
      data: { email: 'new@example.com', registrationTenant: 42 },
      req: {
        user: {
          id: 9,
          tenants: [
            { tenant: 42, roles: ['admin'] },
            { tenant: 77, roles: ['admin'] },
          ],
        },
        context: {},
        payload: { findByID: vi.fn() },
      },
    })

    expect(data.registrationTenant).toBe(77)
    expect(data.tenants).toBeUndefined()
  })

  it('replaces a foreign registrationTenant with the creator\'s only membership', async () => {
    const data = await ensureCreateTenantScope({
      data: {
        email: 'new@example.com',
        registrationTenant: 999,
        tenants: [{ tenant: 999, roles: ['admin'] }],
      },
      req: {
        user: { id: 9, tenants: [{ tenant: 42, roles: ['admin'] }] },
        context: {},
        payload: { findByID: vi.fn() },
      },
    })

    expect(data.registrationTenant).toBe(42)
    expect(data.tenants).toEqual([])
  })

  it('drops a foreign registrationTenant when several memberships and nothing is selected', async () => {
    const data = await ensureCreateTenantScope({
      data: {
        email: 'new@example.com',
        registrationTenant: 999,
        tenants: [{ tenant: 999, roles: ['admin'] }],
      },
      req: {
        user: {
          id: 9,
          tenants: [
            { tenant: 42, roles: ['admin'] },
            { tenant: 77, roles: ['admin'] },
          ],
        },
        context: {},
        payload: { findByID: vi.fn() },
      },
    })

    expect(data.registrationTenant).toBeUndefined()
    expect(data.tenants).toEqual([])
  })

  it('passes req into the anonymous tenant lookup', async () => {
    vi.mocked(getTenantIdForCreateRequest).mockResolvedValue(15)
    const findByID = vi.fn(async () => ({ id: 15 }))
    const req = {
      user: null,
      context: {},
      headers: new Headers({ host: 'acme.localhost:3000' }),
      payload: { findByID },
    }

    const data = await ensureCreateTenantScope({
      data: { email: 'public@example.com' },
      req,
    })

    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ id: 15, req }))
    expect(data.registrationTenant).toBe(15)
  })
})
