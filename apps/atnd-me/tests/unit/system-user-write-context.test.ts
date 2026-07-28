import { describe, it, expect } from 'vitest'

import {
  ATND_SYSTEM_USER_WRITE_ALLOWED_ROLES_CTX,
  ATND_SYSTEM_USER_WRITE_CTX,
  getSystemUserWriteAllowedRoles,
  isSystemUserWrite,
  systemUserWriteContext,
} from '@/lib/auth/systemUserWriteContext'
import { sanitizeUserTenantsAndRolesForWrite } from '@/collections/Users/sanitizeUserWrite'
import type { PayloadRequest } from 'payload'

function req(partial: {
  user?: unknown
  context?: Record<string, unknown>
  payloadAPI?: 'REST' | 'GraphQL' | 'local'
}): PayloadRequest {
  return partial as PayloadRequest
}

describe('systemUserWriteContext', () => {
  it('defaults allowedRoles to user only', () => {
    expect(systemUserWriteContext()).toEqual({
      [ATND_SYSTEM_USER_WRITE_CTX]: true,
      [ATND_SYSTEM_USER_WRITE_ALLOWED_ROLES_CTX]: ['user'],
    })
  })

  it('stores an explicit allow-list', () => {
    const ctx = systemUserWriteContext({ allowedRoles: ['admin', 'user'], extra: { foo: 1 } })
    expect(ctx).toEqual({
      foo: 1,
      [ATND_SYSTEM_USER_WRITE_CTX]: true,
      [ATND_SYSTEM_USER_WRITE_ALLOWED_ROLES_CTX]: ['admin', 'user'],
    })
    expect(getSystemUserWriteAllowedRoles({ context: ctx })).toEqual(['admin', 'user'])
  })

  it('is only true when the flag is present', () => {
    expect(isSystemUserWrite({ context: systemUserWriteContext() })).toBe(true)
    expect(isSystemUserWrite({ context: {} })).toBe(false)
    expect(isSystemUserWrite(undefined)).toBe(false)
  })
})

describe('sanitizeUserTenantsAndRolesForWrite', () => {
  it('drops tenants and forces role=user for anonymous REST writes', () => {
    const data = sanitizeUserTenantsAndRolesForWrite({
      data: {
        tenants: [{ tenant: 4, roles: ['admin'] }],
        role: ['staff', 'location-manager', 'super-admin'],
      },
      req: req({ payloadAPI: 'REST' }),
    })

    expect(data.tenants).toBeUndefined()
    expect(data.role).toEqual(['user'])
  })

  it('preserves tenants/roles for trusted Local API without system flag', () => {
    const data = sanitizeUserTenantsAndRolesForWrite({
      data: {
        tenants: [{ tenant: 4, roles: ['admin'] }],
        role: ['super-admin'],
      },
      req: req({ payloadAPI: 'local' }),
    })

    expect(data.tenants).toEqual([{ tenant: 4, roles: ['admin'] }])
    expect(data.role).toEqual(['super-admin'])
  })

  it('clamps system writes to the declared allow-list', () => {
    const data = sanitizeUserTenantsAndRolesForWrite({
      data: {
        tenants: [
          { tenant: 1, roles: ['admin'] },
          { tenant: 2, roles: ['staff', 'user'] },
        ],
        role: ['admin', 'staff'],
      },
      req: req({
        payloadAPI: 'local',
        context: systemUserWriteContext({ allowedRoles: ['user', 'admin'] }),
      }),
    })

    expect(data.tenants).toEqual([
      { tenant: 1, roles: ['admin'] },
      { tenant: 2, roles: ['user'] },
    ])
    expect(data.role).toEqual(['admin'])
  })

  it('does not alter authenticated non-system writes (other hooks own that)', () => {
    const input = {
      tenants: [{ tenant: 1, roles: ['admin'] }],
      role: ['admin'],
    }
    const data = sanitizeUserTenantsAndRolesForWrite({
      data: { ...input, tenants: [...input.tenants] },
      req: req({ user: { id: 1, role: ['admin'] }, payloadAPI: 'REST' }),
    })
    expect(data.tenants).toEqual([{ tenant: 1, roles: ['admin'] }])
    expect(data.role).toEqual(['admin'])
  })
})
