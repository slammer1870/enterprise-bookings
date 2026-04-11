import { describe, it, expect } from 'vitest'
import type { User } from '@repo/shared-types'
import { checkRole, getEffectiveUserRoles } from '@repo/shared-utils'

describe('checkRole with Better Auth `role`', () => {
  it('matches roles stored on `role` (hasMany array)', () => {
    expect(checkRole(['admin'], { id: 1, role: ['admin', 'user'] } as User)).toBe(true)
  })

  it('still matches deprecated `roles` until fully migrated', () => {
    expect(checkRole(['admin'], { id: 1, roles: ['admin'] } as User)).toBe(true)
  })

  it('merges `role` ahead of legacy `roles`', () => {
    const u = { id: 1, role: ['staff'], roles: ['admin'] } as User
    expect(getEffectiveUserRoles(u)).toEqual(['staff', 'admin'])
    expect(checkRole(['admin'], u)).toBe(true)
  })

  it('parses comma-separated role strings', () => {
    const u = { id: 1, role: 'admin, user' } as unknown as User
    expect(getEffectiveUserRoles(u)).toEqual(['admin', 'user'])
    expect(checkRole(['user'], u)).toBe(true)
  })
})
