import { describe, expect, it } from 'vitest'

import {
  formatDocumentSlug,
  normalizeAndValidateDocumentSlug,
} from '@/utilities/documentSlug'

describe('formatDocumentSlug', () => {
  it('lowercases and converts spaces/underscores to hyphens', () => {
    expect(formatDocumentSlug('Hello World')).toBe('hello-world')
    expect(formatDocumentSlug('hello_world')).toBe('hello-world')
  })

  it('strips invalid URL characters', () => {
    expect(formatDocumentSlug('About Us!!!')).toBe('about-us')
    expect(formatDocumentSlug('path/with/slashes')).toBe('pathwithslashes')
    expect(formatDocumentSlug('query?x=1')).toBe('queryx1')
    expect(formatDocumentSlug('hash#section')).toBe('hashsection')
  })

  it('collapses consecutive separators and trims hyphens', () => {
    expect(formatDocumentSlug('  --Hello--World--  ')).toBe('hello-world')
  })

  it('returns empty for unusable input', () => {
    expect(formatDocumentSlug('!!!')).toBe('')
    expect(formatDocumentSlug('')).toBe('')
    expect(formatDocumentSlug(null)).toBe('')
  })
})

describe('normalizeAndValidateDocumentSlug', () => {
  it('accepts and formats valid-ish input', () => {
    expect(normalizeAndValidateDocumentSlug('About Us')).toEqual({
      ok: true,
      slug: 'about-us',
    })
    expect(normalizeAndValidateDocumentSlug('home')).toEqual({
      ok: true,
      slug: 'home',
    })
  })

  it('rejects empty / unusable slugs', () => {
    expect(normalizeAndValidateDocumentSlug('!!!')).toMatchObject({ ok: false })
    expect(normalizeAndValidateDocumentSlug('')).toMatchObject({ ok: false })
    expect(normalizeAndValidateDocumentSlug('   ')).toMatchObject({ ok: false })
  })
})
