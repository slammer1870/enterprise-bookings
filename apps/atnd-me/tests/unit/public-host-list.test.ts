import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Field } from 'payload'
import { PublicHostList } from '@/components/admin/PublicHostList'
import { Tenants } from '@/collections/Tenants'

const origEnv = process.env
const originalFetch = globalThis.fetch

beforeEach(() => {
  process.env = { ...origEnv, NEXT_PUBLIC_SERVER_URL: 'https://atnd.me/' }
  delete process.env.CLOUDFLARE_API_TOKEN
  delete process.env.CLOUDFLARE_ZONE_ID
  delete process.env.CLOUDFLARE_APEX_PROXYING_A
  delete process.env.CLOUDFLARE_APEX_PROXYING_AAAA
})

afterEach(() => {
  process.env = origEnv
  globalThis.fetch = originalFetch
})

type CloudflareHostnameFixture = {
  id: string
  status: string
  verification_errors?: string[]
  ownership_verification?: { type: string; name: string; value: string }
  ssl?: {
    status?: string
    validation_records?: Array<{ status?: string; txt_name?: string; txt_value?: string }>
    dcv_delegation_records?: Array<{ txt_name?: string; txt_value?: string; cname?: string; cname_target?: string }>
  }
}

function installCloudflare(records: Record<string, CloudflareHostnameFixture>) {
  process.env.CLOUDFLARE_API_TOKEN = 'cf-token-xyz'
  process.env.CLOUDFLARE_ZONE_ID = 'zone-abc123'
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    const hostname = url.searchParams.get('hostname')
    if (hostname != null) {
      const record = records[hostname]
      return Response.json({ result: record ? [record] : [], success: true, errors: [] })
    }
    const id = url.pathname.split('/').pop()
    const record = Object.values(records).find((candidate) => candidate.id === id)
    if (!record) return Response.json({ result: null, success: false, errors: [] }, { status: 404 })
    return Response.json({ result: record, success: true, errors: [] })
  })
}

async function renderedHtml(data: Record<string, unknown>): Promise<string> {
  const node = await PublicHostList({ data } as never)
  return node == null ? '' : renderToStaticMarkup(node)
}

function rowsFromHtml(html: string): string[] {
  const tbody = html.match(/<tbody[\s\S]*<\/tbody>/)?.[0] ?? ''
  return [...tbody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((match) =>
    match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  )
}

async function renderedRows(data: Record<string, unknown>): Promise<string[]> {
  return rowsFromHtml(await renderedHtml(data))
}

describe('public host list', () => {
  it('lists saved hostnames in typed order, with Allow www and non-www roles, then the platform subdomain', async () => {
    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['www.example.com', 'example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'www.example.com serving CNAME www cname.atnd.me Unknown Unknown',
      'example.com canonical CNAME @ cname.atnd.me Unknown Unknown',
      'studio.atnd.me alias to example.com',
    ])
  })

  it('marks www canonical and the apex an alias to www when Direction is Redirect to www', async () => {
    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['www.example.com', 'example.com'],
      direction: 'redirect-to-www',
    })

    expect(rows).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me Unknown Unknown',
      'example.com alias to www.example.com CNAME @ cname.atnd.me Unknown Unknown',
      'studio.atnd.me alias to www.example.com',
    ])
  })

  it('marks www an alias to the apex and the apex canonical when Direction is Redirect to non-www', async () => {
    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['www.example.com', 'example.com'],
      direction: 'redirect-to-non-www',
    })

    expect(rows).toEqual([
      'www.example.com alias to example.com CNAME www cname.atnd.me Unknown Unknown',
      'example.com canonical CNAME @ cname.atnd.me Unknown Unknown',
      'studio.atnd.me alias to example.com',
    ])
  })

  it('marks a lone apex, a lone www host, and a hostname with no pair partner as canonical', async () => {
    const apex = await renderedRows({
      slug: 'studio',
      hostnames: ['example.com'],
      direction: 'allow-www-and-non-www',
    })
    const www = await renderedRows({
      slug: 'studio',
      hostnames: ['www.example.com'],
      direction: 'allow-www-and-non-www',
    })
    const multiLabel = await renderedRows({
      slug: 'studio',
      hostnames: ['blog.example.co.uk'],
      direction: 'allow-www-and-non-www',
    })
    const nested = await renderedRows({
      slug: 'studio',
      hostnames: ['mysite.example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(apex[0]).toBe('example.com canonical CNAME @ cname.atnd.me Unknown Unknown')
    expect(www[0]).toBe('www.example.com canonical CNAME www cname.atnd.me Unknown Unknown')
    expect(multiLabel[0]).toBe('blog.example.co.uk canonical CNAME blog cname.atnd.me Unknown Unknown')
    expect(nested[0]).toBe('mysite.example.com canonical CNAME mysite cname.atnd.me Unknown Unknown')
    expect(apex.at(-1)).toBe('studio.atnd.me alias to example.com')
    expect(www.at(-1)).toBe('studio.atnd.me alias to www.example.com')
    expect(multiLabel.at(-1)).toBe('studio.atnd.me alias to blog.example.co.uk')
    expect(nested.at(-1)).toBe('studio.atnd.me alias to mysite.example.com')
  })

  it('shows www.other.com without other.com as serving', async () => {
    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['www.example.com', 'example.com', 'www.other.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'www.example.com serving CNAME www cname.atnd.me Unknown Unknown',
      'example.com canonical CNAME @ cname.atnd.me Unknown Unknown',
      'www.other.com serving CNAME www cname.atnd.me Unknown Unknown',
      'studio.atnd.me alias to example.com',
    ])
  })

  it('marks the platform subdomain canonical when the hostname list is empty', async () => {
    const rows = await renderedRows({
      slug: 'studio',
      hostnames: [],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual(['studio.atnd.me canonical'])
  })

  it('keeps Apex Proxying and conditional TXT rows on a hostname-list apex', async () => {
    process.env.CLOUDFLARE_APEX_PROXYING_A = '192.0.2.10'
    installCloudflare({
      'example.com': {
        id: 'csh-apex',
        status: 'pending',
        ownership_verification: {
          type: 'txt',
          name: '_cf-custom-hostname.example.com',
          value: 'ownership-token',
        },
        ssl: { status: 'pending_validation' },
      },
    })

    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['www.example.com', 'example.com'],
      direction: 'redirect-to-non-www',
    })

    expect(rows).toEqual([
      'www.example.com alias to example.com CNAME www cname.atnd.me Unknown Unknown',
      'example.com canonical CNAME @ cname.atnd.me Pending Pending',
      'TXT _cf-custom-hostname.example.com ownership-token',
      'A @ 192.0.2.10',
      'studio.atnd.me alias to example.com',
    ])
  })

  it('lists saved hostnames in typed order, then the platform subdomain as an alias to the canonical host', async () => {
    const rows = await renderedRows({
      slug: 'bru-grappling',
      hostnames: ['brugrappling.ie', 'www.brugrappling.ie', 'blog.shop.example.co.uk'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'brugrappling.ie canonical CNAME @ cname.atnd.me Unknown Unknown',
      'www.brugrappling.ie serving CNAME www cname.atnd.me Unknown Unknown',
      'blog.shop.example.co.uk serving CNAME blog.shop cname.atnd.me Unknown Unknown',
      'bru-grappling.atnd.me alias to brugrappling.ie',
    ])
  })

  it('normalizes hostnames before showing the routing record', async () => {
    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['WWW.Example.COM', 'Blog.Example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me Unknown Unknown',
      'blog.example.com serving CNAME blog cname.atnd.me Unknown Unknown',
      'studio.atnd.me alias to www.example.com',
    ])
  })

  it('does not prescribe TTL or an anycast A record for a labeled host', async () => {
    const html = await renderedHtml({
      slug: 'studio',
      hostnames: ['www.example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rowsFromHtml(html)).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me Unknown Unknown',
      'studio.atnd.me alias to www.example.com',
    ])
    expect(html.toLowerCase()).not.toContain('ttl')
    expect(html.toLowerCase()).not.toContain('anycast')
    expect(html).not.toContain('>A<')
    expect(html).not.toContain('Ask the client')
  })

  it('shows Apex Proxying A and AAAA rows at @ on an apex, and not on a labeled host', async () => {
    process.env.CLOUDFLARE_APEX_PROXYING_A = '192.0.2.10, 192.0.2.11'
    process.env.CLOUDFLARE_APEX_PROXYING_AAAA = '2001:db8::10'

    const html = await renderedHtml({
      slug: 'bru-grappling',
      hostnames: ['brugrappling.ie', 'www.brugrappling.ie'],
      direction: 'allow-www-and-non-www',
    })

    expect(rowsFromHtml(html)).toEqual([
      'brugrappling.ie canonical CNAME @ cname.atnd.me Unknown Unknown',
      'A @ 192.0.2.10',
      'A @ 192.0.2.11',
      'AAAA @ 2001:db8::10',
      'www.brugrappling.ie serving CNAME www cname.atnd.me Unknown Unknown',
      'bru-grappling.atnd.me alias to brugrappling.ie',
    ])
    expect(html.toLowerCase()).not.toContain('ttl')
  })

  it('omits an Apex Proxying family when that allocated address is unknown', async () => {
    process.env.CLOUDFLARE_APEX_PROXYING_A = '192.0.2.10'

    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'example.com canonical CNAME @ cname.atnd.me Unknown Unknown',
      'A @ 192.0.2.10',
      'studio.atnd.me alias to example.com',
    ])
  })

  it('shows Apex Proxying rows on an alias apex and not on a labeled canonical host', async () => {
    process.env.CLOUDFLARE_APEX_PROXYING_A = '192.0.2.10'
    process.env.CLOUDFLARE_APEX_PROXYING_AAAA = '2001:db8::10'

    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['www.example.com', 'example.com'],
      direction: 'redirect-to-www',
    })

    expect(rows).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me Unknown Unknown',
      'example.com alias to www.example.com CNAME @ cname.atnd.me Unknown Unknown',
      'A @ 192.0.2.10',
      'AAAA @ 2001:db8::10',
      'studio.atnd.me alias to www.example.com',
    ])
  })

  it('does not show the SaaS target or a non-address as an Apex Proxying record', async () => {
    process.env.CLOUDFLARE_APEX_PROXYING_A = 'cname.atnd.me, 192.0.2.10, 2001:db8::10'
    process.env.CLOUDFLARE_APEX_PROXYING_AAAA = 'cname.atnd.me'

    const html = await renderedHtml({
      slug: 'studio',
      hostnames: ['example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rowsFromHtml(html)).toEqual([
      'example.com canonical CNAME @ cname.atnd.me Unknown Unknown',
      'A @ 192.0.2.10',
      'studio.atnd.me alias to example.com',
    ])
    expect(html).not.toContain('>AAAA<')
    expect(html.match(/cname\.atnd\.me/g)).toEqual(['cname.atnd.me'])
  })

  it('leaves DNS and certificate status off Apex Proxying rows', async () => {
    process.env.CLOUDFLARE_APEX_PROXYING_A = '192.0.2.10'
    process.env.CLOUDFLARE_APEX_PROXYING_AAAA = '2001:db8::10'
    installCloudflare({
      'example.com': { id: 'csh-apex', status: 'active', ssl: { status: 'active' } },
    })

    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'example.com canonical CNAME @ cname.atnd.me Active Active',
      'A @ 192.0.2.10',
      'AAAA @ 2001:db8::10',
      'studio.atnd.me alias to example.com',
    ])
  })

  it('keeps the routing record host when the SaaS target is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SERVER_URL

    const html = await renderedHtml({
      slug: 'studio',
      hostnames: ['example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rowsFromHtml(html)).toEqual(['example.com canonical CNAME @ Unknown Unknown'])
    expect(html).not.toContain('not configured')
  })

  it('shows Active DNS status and Active certificate status on the routing record when Cloudflare reports both active', async () => {
    installCloudflare({
      'www.example.com': { id: 'csh-www', status: 'active', ssl: { status: 'active' } },
    })

    const html = await renderedHtml({
      slug: 'studio',
      hostnames: ['www.example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(html).toContain('DNS status')
    expect(html).toContain('Certificate status')
    expect(rowsFromHtml(html)).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me Active Active',
      'studio.atnd.me alias to www.example.com',
    ])
  })

  it('keeps DNS status and certificate status separate when the hostname is pending and the certificate is active', async () => {
    installCloudflare({
      'www.example.com': { id: 'csh-www', status: 'pending', ssl: { status: 'active' } },
    })

    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['www.example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me Pending Active',
      'studio.atnd.me alias to www.example.com',
    ])
  })

  it('treats hostname active_redeploying as Active DNS status', async () => {
    installCloudflare({
      'www.example.com': { id: 'csh-www', status: 'active_redeploying', ssl: { status: 'active' } },
    })

    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['www.example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows[0]).toBe('www.example.com canonical CNAME www cname.atnd.me Active Active')
  })

  it('keeps a certificate that is still being issued as Pending, including staging_active and backup_issued', async () => {
    const issuing = [
      ['www.example.com', 'staging_active'],
      ['backup.example.com', 'backup_issued'],
      ['init.example.com', 'initializing'],
      ['validation.example.com', 'pending_validation'],
      ['issuance.example.com', 'pending_issuance'],
      ['deployment.example.com', 'pending_deployment'],
      ['staging-deployment.example.com', 'staging_deployment'],
      ['pending-ssl.example.com', 'pending'],
    ] as const
    installCloudflare(
      Object.fromEntries(
        issuing.map(([hostname, sslStatus], index) => [
          hostname,
          { id: `csh-${index}`, status: 'active', ssl: { status: sslStatus } },
        ]),
      ),
    )

    const rows = await renderedRows({
      slug: 'studio',
      hostnames: issuing.map(([hostname]) => hostname),
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me Active Pending',
      'backup.example.com serving CNAME backup cname.atnd.me Active Pending',
      'init.example.com serving CNAME init cname.atnd.me Active Pending',
      'validation.example.com serving CNAME validation cname.atnd.me Active Pending',
      'issuance.example.com serving CNAME issuance cname.atnd.me Active Pending',
      'deployment.example.com serving CNAME deployment cname.atnd.me Active Pending',
      'staging-deployment.example.com serving CNAME staging-deployment cname.atnd.me Active Pending',
      'pending-ssl.example.com serving CNAME pending-ssl cname.atnd.me Active Pending',
      'studio.atnd.me alias to www.example.com',
    ])
  })

  it('shows blocked, moved, and deleted hostnames as Error, with Cloudflare verification errors under DNS status', async () => {
    installCloudflare({
      'blocked.example.com': {
        id: 'csh-blocked',
        status: 'blocked',
        verification_errors: ['custom hostname blocked', 'caa record forbids issuance'],
        ssl: { status: 'pending_validation' },
      },
      'moved.example.com': { id: 'csh-moved', status: 'moved', ssl: { status: 'active' } },
      'deleted.example.com': { id: 'csh-deleted', status: 'deleted', ssl: { status: 'active' } },
    })

    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['blocked.example.com', 'moved.example.com', 'deleted.example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'blocked.example.com canonical CNAME blocked cname.atnd.me Error custom hostname blocked caa record forbids issuance Pending',
      'moved.example.com serving CNAME moved cname.atnd.me Error Active',
      'deleted.example.com serving CNAME deleted cname.atnd.me Error Active',
      'studio.atnd.me alias to blocked.example.com',
    ])
  })

  it('shows Unknown, and still shows the routing record, when the custom hostname is missing or the status is unmapped', async () => {
    installCloudflare({
      'unmapped.example.com': { id: 'csh-unmapped', status: 'pending_blocked', ssl: { status: 'expired' } },
      'inactive.example.com': { id: 'csh-inactive', status: 'active', ssl: { status: 'inactive' } },
      'held.example.com': { id: 'csh-held', status: 'active', ssl: { status: 'holding_deployment' } },
    })

    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['missing.example.com', 'unmapped.example.com', 'inactive.example.com', 'held.example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'missing.example.com canonical CNAME missing cname.atnd.me Unknown Unknown',
      'unmapped.example.com serving CNAME unmapped cname.atnd.me Unknown Unknown',
      'inactive.example.com serving CNAME inactive cname.atnd.me Active Unknown',
      'held.example.com serving CNAME held cname.atnd.me Active Unknown',
      'studio.atnd.me alias to missing.example.com',
    ])
  })

  it('leaves a dropped hostname off the list even when Cloudflare still knows it', async () => {
    installCloudflare({
      'www.example.com': { id: 'csh-www', status: 'active', ssl: { status: 'active' } },
      'old.example.com': { id: 'csh-old', status: 'active', ssl: { status: 'active' } },
    })

    const html = await renderedHtml({
      slug: 'studio',
      hostnames: ['www.example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rowsFromHtml(html)).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me Active Active',
      'studio.atnd.me alias to www.example.com',
    ])
    expect(html).not.toContain('old.example.com')
  })

  it('shows Unknown, and still shows the routing record, when the Cloudflare API cannot be read', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'cf-token-xyz'
    process.env.CLOUDFLARE_ZONE_ID = 'zone-abc123'
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 500 }))

    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['www.example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me Unknown Unknown',
      'studio.atnd.me alias to www.example.com',
    ])
  })

  it('adds the ownership TXT while DNS status is not Active and Cloudflare has issued it', async () => {
    installCloudflare({
      'www.example.com': {
        id: 'csh-www',
        status: 'pending',
        ownership_verification: {
          type: 'txt',
          name: '_cf-custom-hostname.www.example.com',
          value: 'ownership-token',
        },
        ssl: { status: 'active' },
      },
    })

    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['www.example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me Pending Active',
      'TXT _cf-custom-hostname.www.example.com ownership-token',
      'studio.atnd.me alias to www.example.com',
    ])
  })

  it('adds each _acme-challenge TXT while the certificate is not Active, and leaves delegated DCV off the list', async () => {
    installCloudflare({
      'example.com': {
        id: 'csh-apex',
        status: 'active',
        ownership_verification: {
          type: 'txt',
          name: '_cf-custom-hostname.example.com',
          value: 'ownership-token',
        },
        ssl: {
          status: 'pending_validation',
          validation_records: [
            { status: 'pending', txt_name: '_acme-challenge.example.com', txt_value: 'acme-token-1' },
            { status: 'pending', txt_name: '_acme-challenge.example.com', txt_value: 'acme-token-2' },
          ],
          dcv_delegation_records: [
            {
              cname: '_acme-challenge.example.com',
              cname_target: 'example.com.8f3d.dcv.cloudflare.com',
              txt_name: '_acme-challenge.example.com',
              txt_value: 'example.com.8f3d.dcv.cloudflare.com',
            },
          ],
        },
      },
    })

    const html = await renderedHtml({
      slug: 'studio',
      hostnames: ['example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rowsFromHtml(html)).toEqual([
      'example.com canonical CNAME @ cname.atnd.me Active Pending',
      'TXT _acme-challenge.example.com acme-token-1',
      'TXT _acme-challenge.example.com acme-token-2',
      'studio.atnd.me alias to example.com',
    ])
    expect(html).not.toContain('ownership-token')
    expect(html).not.toContain('dcv.cloudflare.com')
  })

  it('shows the ownership TXT and each _acme-challenge TXT together while neither status is Active', async () => {
    installCloudflare({
      'www.example.com': {
        id: 'csh-www',
        status: 'pending',
        ownership_verification: {
          type: 'txt',
          name: '_cf-custom-hostname.www.example.com',
          value: 'ownership-token',
        },
        ssl: {
          status: 'pending_issuance',
          validation_records: [
            { status: 'pending', txt_name: '_acme-challenge.www.example.com', txt_value: 'acme-token' },
          ],
        },
      },
    })

    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['www.example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me Pending Pending',
      'TXT _cf-custom-hostname.www.example.com ownership-token',
      'TXT _acme-challenge.www.example.com acme-token',
      'studio.atnd.me alias to www.example.com',
    ])
  })

  it('shows neither ownership nor _acme-challenge TXT when the zone is already on Cloudflare', async () => {
    const cloudflareZoneError =
      'The hostname is using Cloudflare and cannot be activated with an TXT or HTTP validation token.'
    installCloudflare({
      'www.example.com': {
        id: 'csh-www',
        status: 'pending',
        verification_errors: [cloudflareZoneError],
        ownership_verification: {
          type: 'txt',
          name: '_cf-custom-hostname.www.example.com',
          value: 'ownership-token',
        },
        ssl: {
          status: 'pending_validation',
          validation_records: [
            { status: 'pending', txt_name: '_acme-challenge.www.example.com', txt_value: 'acme-token' },
          ],
        },
      },
    })

    const html = await renderedHtml({
      slug: 'studio',
      hostnames: ['www.example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rowsFromHtml(html)).toEqual([
      `www.example.com canonical CNAME www cname.atnd.me Pending ${cloudflareZoneError} Pending`,
      'studio.atnd.me alias to www.example.com',
    ])
    expect(html).not.toContain('ownership-token')
    expect(html).not.toContain('acme-token')
  })

  it('still shows the ownership TXT when a verification error does not say the hostname is using Cloudflare', async () => {
    installCloudflare({
      'www.example.com': {
        id: 'csh-www',
        status: 'pending',
        verification_errors: ['caa record forbids issuance'],
        ownership_verification: {
          type: 'txt',
          name: '_cf-custom-hostname.www.example.com',
          value: 'ownership-token',
        },
        ssl: { status: 'active' },
      },
    })

    const rows = await renderedRows({
      slug: 'studio',
      hostnames: ['www.example.com'],
      direction: 'allow-www-and-non-www',
    })

    expect(rows).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me Pending caa record forbids issuance Active',
      'TXT _cf-custom-hostname.www.example.com ownership-token',
      'studio.atnd.me alias to www.example.com',
    ])
  })
})

function collectFields(fields: Field[] | undefined): Field[] {
  if (!fields) return []
  const out: Field[] = []
  for (const field of fields) {
    out.push(field)
    if ('fields' in field && Array.isArray(field.fields)) {
      out.push(...collectFields(field.fields))
    }
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        if ('fields' in tab && Array.isArray(tab.fields)) {
          out.push(...collectFields(tab.fields))
        }
      }
    }
  }
  return out
}

function namedFields(fields: Field[] | undefined): Array<Field & { name: string }> {
  return (fields ?? []).filter((field): field is Field & { name: string } => 'name' in field && typeof field.name === 'string')
}

describe('tenant admin public host panels', () => {
  it('shows one public host list and keeps the email panel separate', () => {
    const uiFields = collectFields(Tenants.fields).filter((field) => field.type === 'ui')
    const componentPaths = uiFields.map((field) => {
      const components = field.admin?.components
      if (!components || !('Field' in components)) return undefined
      return components.Field
    })

    expect(componentPaths).toContain('@/components/admin/PublicHostList')
    expect(componentPaths).toContain('@/components/admin/EmailDomainDnsInstructions')
    expect(componentPaths).not.toContain('@/components/admin/DomainDnsInstructions')
    expect(componentPaths).not.toContain('@/components/admin/ApexDnsInstructions')

    const publicHostField = uiFields.find((field) => {
      const components = field.admin?.components
      return components && 'Field' in components && components.Field === '@/components/admin/PublicHostList'
    })
    expect(publicHostField?.admin?.condition).toBeUndefined()
  })

  it('replaces the custom domain, the alias list, and Redirect apex with a hostname field and Direction above the public-host list', () => {
    const fields = namedFields(Tenants.fields)
    const visible = fields.filter((field) => field.admin?.hidden !== true).map((field) => field.name)
    const hostnamesAt = visible.indexOf('hostnames')
    const directionAt = visible.indexOf('direction')
    const publicHostsAt = visible.indexOf('publicHosts')
    const emailAt = visible.indexOf('emailDomainDnsInstructions')

    expect(fields.find((field) => field.name === 'domain')).toBeUndefined()
    expect(fields.find((field) => field.name === 'aliasHosts')).toBeUndefined()
    expect(fields.find((field) => field.name === 'redirectApex')).toBeUndefined()
    expect(fields.find((field) => field.name === 'apexDomain')).toBeUndefined()
    expect(hostnamesAt).toBeGreaterThanOrEqual(0)
    expect(directionAt).toBeGreaterThan(hostnamesAt)
    expect(publicHostsAt).toBeGreaterThan(directionAt)
    expect(emailAt).toBeGreaterThan(publicHostsAt)

    const direction = fields.find((field) => field.name === 'direction')
    expect(direction?.type).toBe('select')
    if (direction?.type !== 'select') return
    expect(direction.defaultValue).toBe('allow-www-and-non-www')
    expect(direction.options).toEqual([
      { label: 'Allow www and non-www', value: 'allow-www-and-non-www' },
      { label: 'Redirect to www', value: 'redirect-to-www' },
      { label: 'Redirect to non-www', value: 'redirect-to-non-www' },
    ])
  })
})
