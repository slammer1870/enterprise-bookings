import { describe, expect, it } from 'vitest'
import { bruCutoverConfirmed } from '../../scripts/bruCutoverConfirmed'
import {
  legacyTenantPublicHostRows,
  migrateLegacyTenantPublicHosts,
  publicHostRowsToWrite,
} from '@/utilities/migrateTenantPublicHosts'

describe('migrateLegacyTenantPublicHosts', () => {
  it('puts the custom domain first and lists each other alias once, in stored order', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 1,
      slug: 'shop',
      domain: 'Shop.Example.com',
      redirectApex: false,
      apexDomain: null,
      aliasHosts: ['shop.example.com', 'extra.example.net', 'EXTRA.Example.net'],
    })

    expect(migrated).toEqual({
      hostnames: ['shop.example.com', 'extra.example.net'],
      direction: 'allow-www-and-non-www',
    })
  })

  it('maps www with Redirect apex and a stored parent to that www host, then the parent, with Redirect to www', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 2,
      slug: 'studio',
      domain: 'WWW.Example.com',
      redirectApex: true,
      apexDomain: 'Example.com',
      aliasHosts: ['booking.example.com', 'example.com'],
    })

    expect(migrated).toEqual({
      hostnames: ['www.example.com', 'example.com', 'booking.example.com'],
      direction: 'redirect-to-www',
    })
  })

  it('leaves an empty stored parent off the list', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 3,
      slug: 'lone-www',
      domain: 'www.example.com',
      redirectApex: true,
      apexDomain: null,
      aliasHosts: [],
    })

    expect(migrated).toEqual({
      hostnames: ['www.example.com'],
      direction: 'allow-www-and-non-www',
    })
  })

  it('leaves the stored parent off the list when Redirect apex is off', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 4,
      slug: 'www-flag-off',
      domain: 'www.example.com',
      redirectApex: false,
      apexDomain: 'example.com',
      aliasHosts: [],
    })

    expect(migrated).toEqual({
      hostnames: ['www.example.com'],
      direction: 'allow-www-and-non-www',
    })
  })

  it('maps an apex whose www is already an alias to that apex, then www, with Redirect to non-www when Redirect apex is off', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 5,
      slug: 'apex',
      domain: 'example.com',
      redirectApex: false,
      apexDomain: null,
      aliasHosts: ['notes.example.net', 'WWW.Example.com'],
    })

    expect(migrated).toEqual({
      hostnames: ['example.com', 'www.example.com', 'notes.example.net'],
      direction: 'redirect-to-non-www',
    })
  })

  it('maps Bru Grappling to the apex, then www, with Redirect to non-www while the stored custom domain is still www', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 9,
      slug: 'Brugrappling',
      domain: 'www.brugrappling.ie',
      redirectApex: true,
      apexDomain: 'brugrappling.ie',
      aliasHosts: ['keep-me.example.net', 'www.brugrappling.ie', 'brugrappling.ie'],
    })

    expect(migrated).toEqual({
      hostnames: ['brugrappling.ie', 'www.brugrappling.ie', 'keep-me.example.net'],
      direction: 'redirect-to-non-www',
    })
  })

  it('leaves a bru-grappling slug on the same mapping as any other row', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 10,
      slug: 'bru-grappling',
      domain: 'www.brugrappling.ie',
      redirectApex: true,
      apexDomain: null,
      aliasHosts: [],
    })

    expect(migrated).toEqual({
      hostnames: ['www.brugrappling.ie'],
      direction: 'allow-www-and-non-www',
    })
  })

  it('stores an empty list and Allow www and non-www when there is no custom domain, and leaves alias hosts off the list', () => {
    const migrated = migrateLegacyTenantPublicHosts({
      id: 6,
      slug: 'bare',
      domain: null,
      redirectApex: true,
      apexDomain: 'example.com',
      aliasHosts: ['decoy.example.com'],
    })

    expect(migrated).toEqual({
      hostnames: [],
      direction: 'allow-www-and-non-www',
    })
  })

  it('stores a lone apex, and classes.example.com, as that one hostname with Allow www and non-www', () => {
    expect(
      migrateLegacyTenantPublicHosts({
        id: 7,
        slug: 'lone-apex',
        domain: 'example.com',
        redirectApex: true,
        apexDomain: 'example.com',
        aliasHosts: [],
      }),
    ).toEqual({
      hostnames: ['example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(
      migrateLegacyTenantPublicHosts({
        id: 8,
        slug: 'classes',
        domain: 'classes.example.com',
        redirectApex: true,
        apexDomain: 'example.com',
        aliasHosts: [],
      }),
    ).toEqual({
      hostnames: ['classes.example.com'],
      direction: 'allow-www-and-non-www',
    })
  })

  it('writes every row, including Bru Grappling, without waiting on cutover', () => {
    const writes = publicHostRowsToWrite([
      {
        id: 1,
        slug: 'studio',
        domain: 'www.studio.example.com',
        redirectApex: true,
        apexDomain: 'studio.example.com',
        aliasHosts: [],
      },
      {
        id: 9,
        slug: 'brugrappling',
        domain: 'www.brugrappling.ie',
        redirectApex: true,
        apexDomain: null,
        aliasHosts: [],
      },
    ])

    expect(writes.map((row) => row.id)).toEqual([1, 9])
    expect(writes[1]).toMatchObject({
      hostnames: ['brugrappling.ie', 'www.brugrappling.ie'],
      direction: 'redirect-to-non-www',
    })
  })

  it('reads the stored custom domain, alias hosts, Redirect apex, and stored parent', () => {
    expect(
      legacyTenantPublicHostRows([
        {
          id: 7,
          slug: 'studio',
          domain: 'www.studio.example.com',
          redirectApex: true,
          apexDomain: 'studio.example.com',
          aliasHosts: ['booking.studio.example.com'],
        },
        { id: '8', slug: 'bare', domain: null, redirectApex: false, apexDomain: null },
        { slug: 'missing-id' },
      ]),
    ).toEqual([
      {
        id: 7,
        slug: 'studio',
        domain: 'www.studio.example.com',
        redirectApex: true,
        apexDomain: 'studio.example.com',
        aliasHosts: ['booking.studio.example.com'],
      },
      {
        id: '8',
        slug: 'bare',
        domain: null,
        redirectApex: false,
        apexDomain: null,
        aliasHosts: [],
      },
    ])
  })

  it('confirms Bru cutover only when the apex CNAME is live and the homepage rule is gone', () => {
    expect(bruCutoverConfirmed(['--apex-cname-live'])).toBe(false)
    expect(bruCutoverConfirmed(['--homepage-rule-removed'])).toBe(false)
    expect(bruCutoverConfirmed(['--apex-cname-live', '--homepage-rule-removed'])).toBe(true)
  })
})
