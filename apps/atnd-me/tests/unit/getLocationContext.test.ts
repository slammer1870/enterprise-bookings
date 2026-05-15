import { describe, it, expect } from 'vitest'
import { parseBranchSlugFromPathname } from '@/utilities/getLocationContext'
import {
  getPublicBranchSlugFromRequest,
  PUBLIC_BRANCH_SLUG_COOKIE,
} from '@/utilities/tenantRequest'

describe('parseBranchSlugFromPathname', () => {
  it('parses /locations/{slug}', () => {
    expect(parseBranchSlugFromPathname('/locations/dublin')).toBe('dublin')
  })

  it('trims trailing slash and allows deeper paths', () => {
    expect(parseBranchSlugFromPathname('/locations/dublin/')).toBe('dublin')
    expect(parseBranchSlugFromPathname('/locations/dublin/schedule')).toBe('dublin')
  })

  it('decodes URI-encoded slug', () => {
    expect(parseBranchSlugFromPathname('/locations/north%20studio')).toBe('north studio')
  })

  it('returns null when there is no locations segment', () => {
    expect(parseBranchSlugFromPathname('/about')).toBeNull()
    expect(parseBranchSlugFromPathname('/foo/locations/dublin')).toBeNull()
    expect(parseBranchSlugFromPathname('/locations')).toBeNull()
    expect(parseBranchSlugFromPathname('/locations/')).toBeNull()
  })

  it('strips query and hash before parsing', () => {
    expect(parseBranchSlugFromPathname('/locations/dublin?x=1')).toBe('dublin')
    expect(parseBranchSlugFromPathname('/locations/dublin#section')).toBe('dublin')
  })
})

describe('getPublicBranchSlugFromRequest', () => {
  it('reads branch-slug cookie', () => {
    const slug = getPublicBranchSlugFromRequest({
      cookies: {
        get: (name: string) =>
          name === PUBLIC_BRANCH_SLUG_COOKIE ? { value: '  cork  ' } : undefined,
      },
    })
    expect(slug).toBe('cork')
  })

  it('returns null when cookie missing', () => {
    expect(getPublicBranchSlugFromRequest({ cookies: { get: () => undefined } })).toBeNull()
  })
})
