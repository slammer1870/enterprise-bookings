import { describe, expect, it } from 'vitest'
import {
  buildEmergencyContactVerifyToken,
  verifyEmergencyContactToken,
} from '@/lib/emergency-contacts/verify-token'
import { normalizePeopleInput } from '@/lib/emergency-contacts/validate-people'
import { hasEmergencyContactOnFile } from '@/lib/emergency-contacts/lookup'
import {
  buildAuthCallbackURL,
  sanitizeRedirectPath,
} from '@/lib/emergency-contacts/auth-redirect'
import {
  initialPeopleForSession,
  parseEmergencyContactSessionUser,
} from '@/lib/emergency-contacts/resolve-session-user'

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

describe('sanitizeRedirectPath', () => {
  it('accepts safe relative paths', () => {
    expect(sanitizeRedirectPath('/emergency-contacts')).toBe('/emergency-contacts')
  })

  it('rejects open redirects', () => {
    expect(sanitizeRedirectPath('https://evil.example')).toBe('/')
    expect(sanitizeRedirectPath('//evil.example')).toBe('/')
  })
})

describe('buildAuthCallbackURL', () => {
  it('builds a tenant-scoped callback URL from request origin when no tenant slug', () => {
    const url = buildAuthCallbackURL({
      redirectTo: '/emergency-contacts',
      headers: new Headers({ host: 'acme.atnd-me.com', 'x-forwarded-proto': 'https' }),
    })
    expect(url).toBe('https://acme.atnd-me.com/emergency-contacts')
  })

  it('builds a tenant subdomain callback URL when slug is provided', () => {
    const url = buildAuthCallbackURL({
      redirectTo: '/emergency-contacts',
      tenant: { slug: 'acme', domain: 'studio.example.com' },
      headers: new Headers({ host: 'ignored.example.com', 'x-forwarded-proto': 'https' }),
    })
    expect(url).toBe('https://studio.example.com/emergency-contacts')
  })
})

describe('hasEmergencyContactOnFile', () => {
  it('returns true when a record exists', () => {
    expect(
      hasEmergencyContactOnFile({
        id: 1,
        userId: 2,
        status: 'complete',
        people: [],
      }),
    ).toBe(true)
  })

  it('returns false when no record exists', () => {
    expect(hasEmergencyContactOnFile(null)).toBe(false)
  })
})

describe('parseEmergencyContactSessionUser', () => {
  it('parses a valid session user', () => {
    expect(
      parseEmergencyContactSessionUser({
        id: 12,
        email: 'Parent@Example.com',
        name: 'Parent',
      }),
    ).toEqual({
      id: 12,
      email: 'parent@example.com',
      name: 'Parent',
    })
  })

  it('rejects invalid users', () => {
    expect(parseEmergencyContactSessionUser(null)).toBeNull()
    expect(parseEmergencyContactSessionUser({ id: 1 })).toBeNull()
  })
})

describe('initialPeopleForSession', () => {
  it('returns existing people when present', () => {
    const people = initialPeopleForSession(
      {
        id: 1,
        userId: 2,
        status: 'complete',
        people: [
          {
            fullName: 'Emma',
            personType: 'child',
            contacts: [{ name: 'Dad', phone: '123', relationship: 'father' }],
          },
        ],
      },
      'Parent',
    )
    expect(people[0]?.fullName).toBe('Emma')
  })

  it('returns a blank self person when no record exists', () => {
    const people = initialPeopleForSession(null, 'Parent')
    expect(people[0]?.fullName).toBe('Parent')
    expect(people[0]?.personType).toBe('self')
  })
})
