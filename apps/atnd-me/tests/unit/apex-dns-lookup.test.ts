import { describe, it, expect } from 'vitest'
import { isApexPointingToCloudflare, isCloudflareEdgeIp } from '@/lib/cloudflare/apexDnsLookup'

describe('isCloudflareEdgeIp', () => {
  it('recognises common Cloudflare anycast IPs', () => {
    expect(isCloudflareEdgeIp('104.21.20.107')).toBe(true)
    expect(isCloudflareEdgeIp('172.67.192.89')).toBe(true)
  })

  it('rejects non-Cloudflare IPs', () => {
    expect(isCloudflareEdgeIp('8.8.8.8')).toBe(false)
    expect(isCloudflareEdgeIp('192.168.1.1')).toBe(false)
  })
})

describe('isApexPointingToCloudflare', () => {
  it('returns true when apex IPs match platform cname IPs exactly', () => {
    expect(isApexPointingToCloudflare(
      ['104.21.20.107', '172.67.192.89'],
      ['104.21.20.107', '172.67.192.89'],
    )).toBe(true)
  })

  it('returns true when apex uses different Cloudflare anycast IPs than the platform cname', () => {
    expect(isApexPointingToCloudflare(
      ['104.21.57.64', '172.67.189.95'],
      ['104.21.20.107', '172.67.192.89'],
    )).toBe(true)
  })

  it('returns false when apex has no A records', () => {
    expect(isApexPointingToCloudflare([], ['104.21.20.107'])).toBe(false)
  })

  it('returns false when apex points at a non-Cloudflare origin', () => {
    expect(isApexPointingToCloudflare(['203.0.113.10'], ['104.21.20.107'])).toBe(false)
  })
})
