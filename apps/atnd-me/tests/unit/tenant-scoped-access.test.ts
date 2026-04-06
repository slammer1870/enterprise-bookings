import { describe, expect, it } from 'vitest'
import {
  tenantScopedPublicReadStrict,
  tenantScopedReadFiltered,
} from '../../src/access/tenant-scoped'

type CookieStore = {
  get: (name: string) => { value?: string } | undefined
}

function createCookies(values: Record<string, string | undefined>): CookieStore {
  return {
    get: (name: string) => {
      const value = values[name]
      return value == null ? undefined : { value }
    },
  }
}

function createTenantAdminReq(cookieValues: Record<string, string | undefined> = {}) {
  return {
    user: {
      id: 99,
      roles: ['tenant-admin'],
      tenants: [1, 2],
    },
    payload: {},
    cookies: createCookies(cookieValues),
    headers: new Headers(),
    context: {},
  }
}

describe('tenant scoped access', () => {
  it('scopes tenant-admin filtered reads to the active tenant cookie', async () => {
    const result = await tenantScopedReadFiltered({
      req: createTenantAdminReq({ 'payload-tenant': '2' }),
    } as any)

    expect(result).toEqual({
      tenant: {
        equals: 2,
      },
    })
  })

  it('falls back to all assigned tenants when there is no active tenant context', async () => {
    const result = await tenantScopedReadFiltered({
      req: createTenantAdminReq(),
    } as any)

    expect(result).toEqual({
      tenant: {
        in: [1, 2],
      },
    })
  })

  it('denies tenant-admin strict reads when the active tenant is outside their scope', async () => {
    const result = await tenantScopedPublicReadStrict({
      req: createTenantAdminReq({ 'payload-tenant': '3' }),
    } as any)

    expect(result).toBe(false)
  })
})
