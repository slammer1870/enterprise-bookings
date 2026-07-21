import { describe, expect, it } from 'vitest'

import {
  normalizeAndValidateTenantSlugFormat,
  sanitizeTenantSlugInput,
} from '@repo/shared-utils'
import {
  normalizeAndValidateTenantSlug,
  RESERVED_TENANT_SLUGS,
} from '@/lib/onboarding/slug'

describe('sanitizeTenantSlugInput', () => {
  it('lowercases and maps spaces/underscores to hyphens', () => {
    expect(sanitizeTenantSlugInput('My Studio')).toBe('my-studio')
    expect(sanitizeTenantSlugInput('my_studio')).toBe('my-studio')
  })

  it('strips invalid characters and collapses consecutive hyphens', () => {
    expect(sanitizeTenantSlugInput('hello!!!world')).toBe('helloworld')
    expect(sanitizeTenantSlugInput('hello--world')).toBe('hello-world')
    expect(sanitizeTenantSlugInput('-hello')).toBe('hello')
  })
})

describe('normalizeAndValidateTenantSlugFormat', () => {
  it('accepts valid subdomain labels', () => {
    expect(normalizeAndValidateTenantSlugFormat('Bru-Studio')).toEqual({
      ok: true,
      slug: 'bru-studio',
    })
    expect(normalizeAndValidateTenantSlugFormat('a1')).toEqual({ ok: true, slug: 'a1' })
  })

  it('rejects empty / too short / trailing hyphen', () => {
    expect(normalizeAndValidateTenantSlugFormat('')).toMatchObject({ ok: false })
    expect(normalizeAndValidateTenantSlugFormat('a')).toMatchObject({ ok: false })
    expect(normalizeAndValidateTenantSlugFormat('hello-')).toMatchObject({ ok: false })
    expect(normalizeAndValidateTenantSlugFormat('!!!')).toMatchObject({ ok: false })
  })

  it('sanitizes dots and symbols into a valid label when possible', () => {
    expect(normalizeAndValidateTenantSlugFormat('hello.world')).toEqual({
      ok: true,
      slug: 'helloworld',
    })
  })
})

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
    expect(normalizeAndValidateTenantSlug('hello_world')).toEqual({
      ok: true,
      slug: 'hello-world',
    })
    expect(normalizeAndValidateTenantSlug('-hello')).toEqual({
      ok: true,
      slug: 'hello',
    })
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
