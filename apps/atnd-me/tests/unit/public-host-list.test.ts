import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Field } from 'payload'
import { PublicHostList } from '@/components/admin/PublicHostList'
import { Tenants } from '@/collections/Tenants'

const origEnv = process.env

beforeEach(() => {
  process.env = { ...origEnv, NEXT_PUBLIC_SERVER_URL: 'https://atnd.me/' }
})

afterEach(() => {
  process.env = origEnv
})

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
  it('lists the canonical host, aliases in named order, then the platform subdomain', async () => {
    const rows = await renderedRows({
      slug: 'bru-grappling',
      domain: 'brugrappling.ie',
      aliasHosts: ['www.brugrappling.ie', 'blog.shop.example.co.uk'],
    })

    expect(rows).toEqual([
      'brugrappling.ie canonical CNAME @ cname.atnd.me',
      'www.brugrappling.ie alias CNAME www cname.atnd.me',
      'blog.shop.example.co.uk alias CNAME blog.shop cname.atnd.me',
      'bru-grappling.atnd.me alias',
    ])
  })

  it('normalizes hostnames before showing the routing record', async () => {
    const rows = await renderedRows({
      slug: 'studio',
      domain: 'WWW.Example.COM',
      aliasHosts: ['Blog.Example.com'],
    })

    expect(rows).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me',
      'blog.example.com alias CNAME blog cname.atnd.me',
      'studio.atnd.me alias',
    ])
  })

  it('marks the platform subdomain canonical when it is the only public host', async () => {
    const rows = await renderedRows({
      slug: 'studio',
      domain: null,
      aliasHosts: [],
    })

    expect(rows).toEqual(['studio.atnd.me canonical'])
  })

  it('ignores redirectApex and does not prescribe TTL or an anycast A record', async () => {
    const html = await renderedHtml({
      slug: 'studio',
      domain: 'www.example.com',
      aliasHosts: [],
      redirectApex: true,
      apexDomain: 'example.com',
    })

    expect(rowsFromHtml(html)).toEqual([
      'www.example.com canonical CNAME www cname.atnd.me',
      'studio.atnd.me alias',
    ])
    expect(html.toLowerCase()).not.toContain('ttl')
    expect(html.toLowerCase()).not.toContain('anycast')
    expect(html).not.toContain('>A<')
    expect(html).not.toContain('Ask the client')
  })

  it('keeps the routing record visible when the SaaS target is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SERVER_URL

    const rows = await renderedRows({
      slug: 'studio',
      domain: 'example.com',
      aliasHosts: [],
    })

    expect(rows).toEqual(['example.com canonical CNAME @ SaaS target is not configured'])
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
})
