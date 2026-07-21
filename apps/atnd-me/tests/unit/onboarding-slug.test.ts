import { describe, expect, it } from 'vitest'

import {
  normalizeAndValidateTenantSlug,
  RESERVED_TENANT_SLUGS,
} from '@/lib/onboarding/slug'

describe('normalizeAndValidateTenantSlug', () => {
  it('accepts valid slugs and lowercases', () => {
    expect(normalizeAndValidateTenantSlug('Bru-Studio')).toEqual({
      ok: true,
      slug: 'bru-studio',
    })
  })

  it('rejects empty / too short', () => {
    expect(normalizeAndValidateTenantSlug('')).toMatchObject({ ok: false })
    expect(normalizeAndValidateTenantSlug('a')).toMatchObject({ ok: false })
  })

  it('rejects invalid characters and leading/trailing hyphens', () => {
    expect(normalizeAndValidateTenantSlug('hello_world')).toMatchObject({ ok: false })
    expect(normalizeAndValidateTenantSlug('-hello')).toMatchObject({ ok: false })
    expect(normalizeAndValidateTenantSlug('hello-')).toMatchObject({ ok: false })
  })

  it('rejects reserved slugs', () => {
    for (const reserved of ['www', 'admin', 'api', 'app']) {
      expect(RESERVED_TENANT_SLUGS.has(reserved)).toBe(true)
      expect(normalizeAndValidateTenantSlug(reserved)).toMatchObject({
        ok: false,
        error: 'This username is reserved',
      })
    }
  })
})
