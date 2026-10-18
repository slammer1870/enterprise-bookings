/**
 * Cloudflare registration follows the old custom-domain hook.
 * The first hostname is registered. Redirect to www also registers its parent.
 * A later hostname, including an alias, is not registered.
 */
import { describe, it, expect } from 'vitest'
import { customHostnamesToRegister } from '@/collections/Tenants/apexDomainHook'

describe('customHostnamesToRegister', () => {
  it('registers the first hostname on create, and not a later hostname', () => {
    expect(
      customHostnamesToRegister({
        operation: 'create',
        hostnames: ['www.example.com', 'example.com', 'notes.example.net'],
        direction: 'allow-www-and-non-www',
      }),
    ).toEqual([{ hostname: 'www.example.com', isApex: false }])
  })

  it('registers the first hostname and its parent when Direction is Redirect to www', () => {
    expect(
      customHostnamesToRegister({
        operation: 'create',
        hostnames: ['www.example.com', 'example.com'],
        direction: 'redirect-to-www',
      }),
    ).toEqual([
      { hostname: 'www.example.com', isApex: false },
      { hostname: 'example.com', isApex: true },
    ])
  })

  it('does not register the www partner when Direction is Redirect to non-www', () => {
    expect(
      customHostnamesToRegister({
        operation: 'create',
        hostnames: ['example.com', 'www.example.com'],
        direction: 'redirect-to-non-www',
      }),
    ).toEqual([{ hostname: 'example.com', isApex: false }])
  })

  it('registers only a changed first hostname', () => {
    expect(
      customHostnamesToRegister({
        operation: 'update',
        hostnames: ['mysite.example.com', 'example.com'],
        previousHostnames: ['www.example.com', 'example.com'],
        direction: 'allow-www-and-non-www',
        previousDirection: 'allow-www-and-non-www',
      }),
    ).toEqual([{ hostname: 'mysite.example.com', isApex: false }])
  })

  it('registers the parent when Direction turns to Redirect to www', () => {
    expect(
      customHostnamesToRegister({
        operation: 'update',
        hostnames: ['www.example.com', 'example.com'],
        previousHostnames: ['www.example.com', 'example.com'],
        direction: 'redirect-to-www',
        previousDirection: 'allow-www-and-non-www',
      }),
    ).toEqual([{ hostname: 'example.com', isApex: true }])
  })

  it('registers nothing when the first hostname and Direction are unchanged', () => {
    expect(
      customHostnamesToRegister({
        operation: 'update',
        hostnames: ['www.example.com', 'example.com', 'notes.example.net'],
        previousHostnames: ['www.example.com', 'example.com'],
        direction: 'redirect-to-www',
        previousDirection: 'redirect-to-www',
      }),
    ).toEqual([])
  })

  it('does not register a later hostname that left the list', () => {
    expect(
      customHostnamesToRegister({
        operation: 'update',
        hostnames: ['www.example.com'],
        previousHostnames: ['www.example.com', 'example.com'],
        direction: 'allow-www-and-non-www',
        previousDirection: 'allow-www-and-non-www',
      }),
    ).toEqual([])
  })
})
