/**
 * Named hostnames are registered with Cloudflare when they are saved.
 * An apex uses TXT validation. A hostname already registered is not registered again.
 */
import { describe, it, expect } from 'vitest'
import { customHostnamesToRegister } from '@/collections/Tenants/apexDomainHook'

describe('customHostnamesToRegister', () => {
  it('registers every named hostname on create, and marks an apex', () => {
    expect(
      customHostnamesToRegister({
        operation: 'create',
        hostnames: ['www.example.com', 'example.com'],
      }),
    ).toEqual([
      { hostname: 'www.example.com', isApex: false },
      { hostname: 'example.com', isApex: true },
    ])
  })

  it('registers only hostnames that were not already named', () => {
    expect(
      customHostnamesToRegister({
        operation: 'update',
        hostnames: ['www.example.com', 'example.com', 'mysite.example.com'],
        previousHostnames: ['www.example.com', 'example.com'],
      }),
    ).toEqual([{ hostname: 'mysite.example.com', isApex: false }])
  })

  it('registers nothing when the hostname list is unchanged', () => {
    expect(
      customHostnamesToRegister({
        operation: 'update',
        hostnames: ['example.com'],
        previousHostnames: ['example.com'],
      }),
    ).toEqual([])
  })

  it('does not register a hostname that left the list', () => {
    expect(
      customHostnamesToRegister({
        operation: 'update',
        hostnames: ['example.com'],
        previousHostnames: ['www.example.com', 'example.com'],
      }),
    ).toEqual([])
  })
})
