import { describe, it, expect } from 'vitest'
import {
  getPayloadLocationIdFromRequest,
  PAYLOAD_LOCATION_COOKIE,
} from '@/utilities/tenantRequest'

function cookiesWith(name: string, value: string) {
  return {
    get: (n: string) => (n === name ? { value } : undefined),
  }
}

describe('getPayloadLocationIdFromRequest', () => {
  it('returns a positive integer id for a valid numeric cookie', () => {
    expect(
      getPayloadLocationIdFromRequest({
        cookies: cookiesWith(PAYLOAD_LOCATION_COOKIE, '7'),
      }),
    ).toBe(7)
  })

  it('trims whitespace around the value', () => {
    expect(
      getPayloadLocationIdFromRequest({
        cookies: cookiesWith(PAYLOAD_LOCATION_COOKIE, '  42  '),
      }),
    ).toBe(42)
  })

  it('returns null when the cookie is missing or empty', () => {
    expect(getPayloadLocationIdFromRequest(null)).toBeNull()
    expect(getPayloadLocationIdFromRequest(undefined)).toBeNull()
    expect(getPayloadLocationIdFromRequest({})).toBeNull()
    expect(
      getPayloadLocationIdFromRequest({
        cookies: cookiesWith(PAYLOAD_LOCATION_COOKIE, ''),
      }),
    ).toBeNull()
    expect(
      getPayloadLocationIdFromRequest({
        cookies: cookiesWith(PAYLOAD_LOCATION_COOKIE, '   '),
      }),
    ).toBeNull()
  })

  it('returns null for non-numeric values', () => {
    expect(
      getPayloadLocationIdFromRequest({
        cookies: cookiesWith(PAYLOAD_LOCATION_COOKIE, 'abc'),
      }),
    ).toBeNull()
    expect(
      getPayloadLocationIdFromRequest({
        cookies: cookiesWith(PAYLOAD_LOCATION_COOKIE, '12x'),
      }),
    ).toBeNull()
    expect(
      getPayloadLocationIdFromRequest({
        cookies: cookiesWith(PAYLOAD_LOCATION_COOKIE, '3.14'),
      }),
    ).toBeNull()
  })
})
