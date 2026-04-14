import { describe, it, expect } from 'vitest'
import {
  userNameFieldReadForStaffRoster,
  userSensitiveFieldReadForStaffRoster,
} from '@/access/staffRosterUserFieldAccess'

function args(user: unknown, doc: { id: number }) {
  return { req: { user }, doc } as Parameters<typeof userNameFieldReadForStaffRoster>[0]
}

describe('staffRosterUserFieldAccess', () => {
  it('staff can read names for other users in roster', () => {
    const staff = { id: 1, role: ['staff'] }
    const other = { id: 2 }
    expect(userNameFieldReadForStaffRoster(args(staff, other))).toBe(true)
  })

  it('staff cannot read sensitive fields for other users', () => {
    const staff = { id: 1, role: ['staff'] }
    const other = { id: 2 }
    expect(userSensitiveFieldReadForStaffRoster(args(staff, other))).toBe(false)
  })

  it('staff can read sensitive fields for self', () => {
    const staff = { id: 1, role: ['staff'] }
    expect(userSensitiveFieldReadForStaffRoster(args(staff, { id: 1 }))).toBe(true)
  })

  it('org admin can read sensitive fields for others', () => {
    const admin = { id: 1, role: ['admin'] }
    expect(userSensitiveFieldReadForStaffRoster(args(admin, { id: 99 }))).toBe(true)
  })
})
