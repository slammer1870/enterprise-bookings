import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  bruCutoverConfirmed,
  legacyTenantPublicHostRows,
  migrateLegacyTenantPublicHosts,
  publicHostRowsToWrite,
} from '@/utilities/migrateTenantPublicHosts'

describe('migrateLegacyTenantPublicHosts', () => {
  const origEnv = process.env

  beforeEach(() => {
    process.env = { ...origEnv, NEXT_PUBLIC_SERVER_URL: 'https://atnd.me/' }
  })

  afterEach(() => {
    process.env = origEnv
  })

  it('keeps a stored serving hostname as the canonical host and makes the platform subdomain an alias', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 1,
      slug: 'studio',
      domain: 'WWW.Studio.Example.com',
      redirectApex: false,
    })

    expect(migrated).toEqual({
      canonicalHost: 'www.studio.example.com',
      aliasHosts: [],
      platformSubdomain: 'studio.atnd.me',
      platformSubdomainRole: 'alias',
    })
  })

  it('adds the registrable apex as an alias when redirectApex was on', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 2,
      slug: 'shop',
      domain: 'blog.shop.example.co.uk',
      redirectApex: true,
    })

    expect(migrated.canonicalHost).toBe('blog.shop.example.co.uk')
    expect(migrated.aliasHosts).toEqual(['example.co.uk'])
    expect(migrated.platformSubdomainRole).toBe('alias')
  })

  it('keeps the platform subdomain canonical when no custom hostname is stored', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 3,
      slug: 'slug-only',
      domain: null,
      redirectApex: true,
    })

    expect(migrated).toEqual({
      canonicalHost: null,
      aliasHosts: [],
      platformSubdomain: 'slug-only.atnd.me',
      platformSubdomainRole: 'canonical',
    })
  })

  it('maps the brugrappling slug to the apex regardless of the stored serving hostname', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 9,
      slug: 'Brugrappling',
      domain: 'www.brugrappling.ie',
      redirectApex: true,
    })

    expect(migrated).toEqual({
      canonicalHost: 'brugrappling.ie',
      aliasHosts: ['www.brugrappling.ie'],
      platformSubdomain: 'brugrappling.atnd.me',
      platformSubdomainRole: 'alias',
    })
  })

  it('keeps the Bru override when the stored hostname is not www', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 9,
      slug: 'brugrappling',
      domain: null,
      redirectApex: false,
    })

    expect(migrated.canonicalHost).toBe('brugrappling.ie')
    expect(migrated.aliasHosts).toEqual(['www.brugrappling.ie'])
    expect(migrated.platformSubdomain).toBe('brugrappling.atnd.me')
    expect(migrated.platformSubdomainRole).toBe('alias')
  })

  it('leaves a bru-grappling slug on the default mapping', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 10,
      slug: 'bru-grappling',
      domain: 'www.brugrappling.ie',
      redirectApex: true,
    })

    expect(migrated).toEqual({
      canonicalHost: 'www.brugrappling.ie',
      aliasHosts: ['brugrappling.ie'],
      platformSubdomain: 'bru-grappling.atnd.me',
      platformSubdomainRole: 'alias',
    })
  })

  it('does not list the canonical host as its own alias when the stored hostname is already the apex', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 4,
      slug: 'apex-only',
      domain: 'example.com',
      redirectApex: true,
    })

    expect(migrated.canonicalHost).toBe('example.com')
    expect(migrated.aliasHosts).toEqual([])
  })

  it('writes every other row immediately and holds Bru until cutover is confirmed', () => {
    const rows = [
      { id: 1, slug: 'studio', domain: 'www.studio.example.com', redirectApex: true },
      { id: 9, slug: 'brugrappling', domain: 'www.brugrappling.ie', redirectApex: true },
    ]

    const pending = publicHostRowsToWrite(rows, { bruCutover: false })
    expect(pending.map((row) => row.id)).toEqual([1])
    expect(pending[0]).toMatchObject({
      canonicalHost: 'www.studio.example.com',
      aliasHosts: ['example.com'],
      platformSubdomainRole: 'alias',
    })

    const cutover = publicHostRowsToWrite(rows, { bruCutover: true })
    expect(cutover.map((row) => row.id)).toEqual([1, 9])
    expect(cutover[1]).toMatchObject({
      canonicalHost: 'brugrappling.ie',
      aliasHosts: ['www.brugrappling.ie'],
      platformSubdomain: 'brugrappling.atnd.me',
      platformSubdomainRole: 'alias',
    })
  })

  it('reads stored domain and redirectApex from a tenant row', () => {
    expect(
      legacyTenantPublicHostRows([
        { id: 7, slug: 'studio', domain: 'www.studio.example.com', redirectApex: true },
        { id: '8', slug: 'bare', domain: null, redirectApex: false },
        { slug: 'missing-id' },
      ]),
    ).toEqual([
      { id: 7, slug: 'studio', domain: 'www.studio.example.com', redirectApex: true },
      { id: '8', slug: 'bare', domain: null, redirectApex: false },
    ])
  })

  it('confirms Bru cutover only when the apex CNAME is live and the homepage rule is gone', () => {
    expect(bruCutoverConfirmed(['--apex-cname-live'])).toBe(false)
    expect(bruCutoverConfirmed(['--homepage-rule-removed'])).toBe(false)
    expect(bruCutoverConfirmed(['--apex-cname-live', '--homepage-rule-removed'])).toBe(true)
  })
})
