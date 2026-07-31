import { describe, expect, it } from 'vitest'
import {
  buildEmergencyContactVerifyToken,
  verifyEmergencyContactToken,
} from '@/lib/emergency-contacts/verify-token'
import { normalizePeopleInput } from '@/lib/emergency-contacts/validate-people'

describe('emergency contact verify token', () => {
  it('round-trips a valid token', () => {
    const token = buildEmergencyContactVerifyToken(42, 7, 'Parent@Example.com')
    const payload = verifyEmergencyContactToken(token)
    expect(payload.userId).toBe(42)
    expect(payload.tenantId).toBe(7)
    expect(payload.email).toBe('parent@example.com')
  })

  it('rejects tampered tokens', () => {
    const token = buildEmergencyContactVerifyToken(1, 2, 'a@b.com')
    const [b64] = token.split('.')
    expect(() => verifyEmergencyContactToken(`${b64}.bogus`)).toThrow(/signature/i)
  })

  it('rejects expired tokens', () => {
    const token = buildEmergencyContactVerifyToken(1, 2, 'a@b.com', Date.now() - 1000)
    expect(() => verifyEmergencyContactToken(token)).toThrow(/expired/i)
  })
})

describe('normalizePeopleInput', () => {
  it('accepts a valid person with contact', () => {
    const { people, error } = normalizePeopleInput([
      {
        fullName: 'Emma Smith',
        personType: 'child',
        contacts: [{ name: 'John', phone: '123', relationship: 'father' }],
      },
    ])
    expect(error).toBeUndefined()
    expect(people).toHaveLength(1)
    expect(people[0]?.fullName).toBe('Emma Smith')
  })

  it('requires at least one person and one contact', () => {
    expect(normalizePeopleInput([]).error).toMatch(/at least one person/i)
    expect(
      normalizePeopleInput([{ fullName: 'Emma', personType: 'child', contacts: [] }]).error,
    ).toMatch(/at least one emergency contact/i)
  })
})
