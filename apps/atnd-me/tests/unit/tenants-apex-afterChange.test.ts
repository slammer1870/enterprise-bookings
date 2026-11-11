/**
 * Cloudflare registration follows the saved hostname list.
 * Every hostname is ensured. A hostname that leaves the list is removed.
 * An apex uses TXT only when leased Apex Proxying addresses are configured.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { customHostnameSync } from '@/collections/Tenants/customHostnameSync'

const originalA = process.env.CLOUDFLARE_APEX_PROXYING_A
const originalAAAA = process.env.CLOUDFLARE_APEX_PROXYING_AAAA

beforeEach(() => {
  delete process.env.CLOUDFLARE_APEX_PROXYING_A
  delete process.env.CLOUDFLARE_APEX_PROXYING_AAAA
})

afterEach(() => {
  if (originalA === undefined) delete process.env.CLOUDFLARE_APEX_PROXYING_A
  else process.env.CLOUDFLARE_APEX_PROXYING_A = originalA
  if (originalAAAA === undefined) delete process.env.CLOUDFLARE_APEX_PROXYING_AAAA
  else process.env.CLOUDFLARE_APEX_PROXYING_AAAA = originalAAAA
})

describe('customHostnameSync', () => {
  it('ensures every hostname on create and removes nothing', () => {
    expect(
      customHostnameSync({
        operation: 'create',
        hostnames: ['www.example.com', 'example.com', 'notes.example.net'],
      }),
    ).toEqual({
      ensure: [
        { hostname: 'www.example.com', isApex: false },
        { hostname: 'example.com', isApex: false },
        { hostname: 'notes.example.net', isApex: false },
      ],
      remove: [],
    })
  })

  it('keeps an apex on HTTP when no leased addresses are configured', () => {
    delete process.env.CLOUDFLARE_APEX_PROXYING_A
    delete process.env.CLOUDFLARE_APEX_PROXYING_AAAA
    expect(
      customHostnameSync({
        operation: 'create',
        hostnames: ['example.com', 'www.example.com'],
      }).ensure,
    ).toEqual([
      { hostname: 'example.com', isApex: false },
      { hostname: 'www.example.com', isApex: false },
    ])
  })

  it('marks an apex for TXT when leased proxying addresses are configured', () => {
    process.env.CLOUDFLARE_APEX_PROXYING_A = '192.0.2.10'
    expect(
      customHostnameSync({
        operation: 'create',
        hostnames: ['example.com', 'www.example.com'],
      }).ensure,
    ).toEqual([
      { hostname: 'example.com', isApex: true },
      { hostname: 'www.example.com', isApex: false },
    ])
  })

  it('removes a hostname that left the list and ensures the replacement', () => {
    expect(
      customHostnameSync({
        operation: 'update',
        hostnames: ['mysite.example.com', 'example.com'],
        previousHostnames: ['www.example.com', 'example.com'],
        previousDirection: 'allow-www-and-non-www',
      }),
    ).toEqual({
      ensure: [
        { hostname: 'mysite.example.com', isApex: false },
        { hostname: 'example.com', isApex: false },
      ],
      remove: ['www.example.com'],
    })
  })

  it('removes nothing when the list is unchanged', () => {
    expect(
      customHostnameSync({
        operation: 'update',
        hostnames: ['www.example.com', 'example.com', 'notes.example.net'],
        previousHostnames: ['www.example.com', 'example.com', 'notes.example.net'],
        previousDirection: 'redirect-to-www',
      }).remove,
    ).toEqual([])
  })

  it('removes every previous hostname when the list is cleared', () => {
    expect(
      customHostnameSync({
        operation: 'update',
        hostnames: [],
        previousHostnames: ['www.example.com', 'notes.example.net'],
        previousDirection: 'allow-www-and-non-www',
      }),
    ).toEqual({
      ensure: [],
      remove: ['www.example.com', 'notes.example.net'],
    })
  })

  it('removes a legacy unlisted parent from Redirect to www', () => {
    expect(
      customHostnameSync({
        operation: 'update',
        hostnames: ['www.example.com'],
        previousHostnames: ['www.example.com'],
        previousDirection: 'redirect-to-www',
      }),
    ).toEqual({
      ensure: [{ hostname: 'www.example.com', isApex: false }],
      remove: ['example.com'],
    })
  })

  it('does not remove the legacy parent when it is still in the list', () => {
    expect(
      customHostnameSync({
        operation: 'update',
        hostnames: ['www.example.com', 'example.com'],
        previousHostnames: ['www.example.com'],
        previousDirection: 'redirect-to-www',
      }).remove,
    ).toEqual([])
  })

  it('does not remove a public suffix when the previous first hostname was already an apex', () => {
    expect(
      customHostnameSync({
        operation: 'update',
        hostnames: ['example.co.uk', 'www.example.co.uk'],
        previousHostnames: ['example.co.uk'],
        previousDirection: 'redirect-to-www',
      }).remove,
    ).toEqual([])
  })

  it('does not remove a legacy parent on create', () => {
    expect(
      customHostnameSync({
        operation: 'create',
        hostnames: ['shop.example.com'],
        previousHostnames: ['www.example.com'],
        previousDirection: 'redirect-to-www',
      }).remove,
    ).toEqual([])
  })
})
