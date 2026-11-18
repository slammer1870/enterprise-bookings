import { describe, it, expect } from 'vitest'
import {
  userEmailFieldReadForLocationManager,
  userEmailFieldWriteForLocationManager,
  userNameFieldReadForStaffRoster,
  userNameFieldWriteForStaffRoster,
  userSensitiveFieldReadForStaffRoster,
} from '@/access/staffRosterUserFieldAccess'

function args(user: unknown, doc?: { id: number } | null) {
  return {
    req: { user },
    doc: doc === null ? undefined : doc,
  } as Parameters<typeof userNameFieldReadForStaffRoster>[0]
}

describe('staffRosterUserFieldAccess', () => {
  it('staff can read names for other users in roster', () => {
    const staff = { id: 1, tenants: [{ tenant: 7, roles: ['staff'] }] }
    const other = { id: 2 }
    expect(userNameFieldReadForStaffRoster(args(staff, other))).toBe(true)
  })

  it('staff cannot read sensitive fields for other users', () => {
    const staff = { id: 1, tenants: [{ tenant: 7, roles: ['staff'] }] }
    const other = { id: 2 }
    expect(userSensitiveFieldReadForStaffRoster(args(staff, other))).toBe(false)
  })

  it('staff can read sensitive fields for self', () => {
    const staff = { id: 1, tenants: [{ tenant: 7, roles: ['staff'] }] }
    expect(userSensitiveFieldReadForStaffRoster(args(staff, { id: 1 }))).toBe(true)
  })

  it('org admin can read sensitive fields for others', () => {
    const admin = { id: 1, tenants: [{ tenant: 7, roles: ['admin'] }] }
    expect(userSensitiveFieldReadForStaffRoster(args(admin, { id: 99 }))).toBe(true)
  })

  it('location-manager can read names for other users in roster', () => {
    const lm = { id: 1, tenants: [{ tenant: 7, roles: ['location-manager'] }] }
    expect(userNameFieldReadForStaffRoster(args(lm, { id: 2 }))).toBe(true)
  })

  it('location-manager can write name on create and for other users', () => {
    const lm = { id: 1, tenants: [{ tenant: 7, roles: ['location-manager'] }] }
    expect(userNameFieldWriteForStaffRoster(args(lm, null))).toBe(true)
    expect(userNameFieldWriteForStaffRoster(args(lm, { id: 2 }))).toBe(true)
  })

  it('location-manager can read and write email for other users', () => {
    const lm = { id: 1, tenants: [{ tenant: 7, roles: ['location-manager'] }] }
    expect(userEmailFieldReadForLocationManager(args(lm, { id: 2 }))).toBe(true)
    expect(userEmailFieldWriteForLocationManager(args(lm, { id: 2 }))).toBe(true)
  })

  it('staff can read email for other users but cannot change it', () => {
    const staff = { id: 1, tenants: [{ tenant: 7, roles: ['staff'] }] }
    expect(userEmailFieldReadForLocationManager(args(staff, { id: 2 }))).toBe(true)
    expect(userEmailFieldReadForLocationManager(args(staff, null))).toBe(true)
    expect(userEmailFieldWriteForLocationManager(args(staff, { id: 2 }))).toBe(false)
    expect(userEmailFieldWriteForLocationManager(args(staff, null))).toBe(true)
    expect(userEmailFieldWriteForLocationManager(args(staff, { id: 1 }))).toBe(true)
  })

  it('derived global staff role can read another user email', () => {
    const staff = { id: 1, role: ['staff'] }
    expect(userEmailFieldReadForLocationManager(args(staff, { id: 2 }))).toBe(true)
  })

  it('a member can read only their own email', () => {
    const member = { id: 1, tenants: [{ tenant: 7, roles: ['user'] }] }
    expect(userEmailFieldReadForLocationManager(args(member, { id: 2 }))).toBe(false)
    expect(userEmailFieldReadForLocationManager(args(member, { id: 1 }))).toBe(true)
  })

  it('location-manager cannot read other sensitive fields for other users', () => {
    const lm = { id: 1, tenants: [{ tenant: 7, roles: ['location-manager'] }] }
    expect(userSensitiveFieldReadForStaffRoster(args(lm, { id: 2 }))).toBe(false)
  })

  it('shallow location-manager session can write name on create', () => {
    const lm = { id: 1, role: ['location-manager'] }
    expect(userNameFieldWriteForStaffRoster(args(lm, null))).toBe(true)
    expect(userNameFieldReadForStaffRoster(args(lm, null))).toBe(true)
  })
})
