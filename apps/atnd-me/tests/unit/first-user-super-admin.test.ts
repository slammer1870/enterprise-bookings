import { describe, it, expect } from 'vitest'

import { applyFirstUserSuperAdminRole } from '@/collections/Users/firstUserSuperAdmin'

describe('applyFirstUserSuperAdminRole', () => {
  it('sets super-admin when this is the first user create and role is empty', () => {
    const data: { role?: unknown } = {}
    applyFirstUserSuperAdminRole(data, 0)
    expect(data.role).toEqual(['super-admin'])
  })

  it('replaces a default user role with super-admin on first create', () => {
    const data: { role?: unknown } = { role: ['user'] }
    applyFirstUserSuperAdminRole(data, 0)
    expect(data.role).toEqual(['super-admin'])
  })

  it('does nothing when the database already has users', () => {
    const data: { role?: unknown } = { role: ['user'] }
    applyFirstUserSuperAdminRole(data, 3)
    expect(data.role).toEqual(['user'])
  })
})
