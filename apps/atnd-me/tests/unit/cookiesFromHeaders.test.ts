import { describe, it, expect } from 'vitest'
import { cookiesFromHeaders, mergeRequestCookies } from '@/utilities/cookiesFromHeaders'

describe('cookiesFromHeaders', () => {
  it('returns undefined for missing cookie name when header absent', () => {
    const h = new Headers()
    const store = cookiesFromHeaders(h)
    expect(store.get('tenant-slug')).toBeUndefined()
  })

  it('parses tenant-slug and payload-tenant from Cookie header', () => {
    const h = new Headers({
      cookie: 'tenant-slug=my-tenant; payload-tenant=42; other=1',
    })
    const store = cookiesFromHeaders(h)
    expect(store.get('tenant-slug')?.value).toBe('my-tenant')
    expect(store.get('payload-tenant')?.value).toBe('42')
  })

  it('decodes URI-encoded values', () => {
    const h = new Headers({
      cookie: 'x=' + encodeURIComponent('a=b'),
    })
    expect(cookiesFromHeaders(h).get('x')?.value).toBe('a=b')
  })
})

describe('mergeRequestCookies', () => {
  it('falls back to Cookie header when req.cookies is empty', () => {
    const headers = new Headers({ cookie: 'payload-tenant=7; tenant-slug=acme' })
    const store = mergeRequestCookies(undefined, headers)
    expect(store.get('payload-tenant')?.value).toBe('7')
    expect(store.get('tenant-slug')?.value).toBe('acme')
  })

  it('prefers req.cookies over Cookie header when both are set', () => {
    const headers = new Headers({ cookie: 'payload-tenant=99' })
    const store = mergeRequestCookies(
      { get: (name) => (name === 'payload-tenant' ? { value: '7' } : undefined) },
      headers,
    )
    expect(store.get('payload-tenant')?.value).toBe('7')
  })
})
