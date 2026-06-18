import { describe, it, expect } from 'vitest'
import { isApexPointingToCloudflare, isCloudflareEdgeIp } from '@/lib/cloudflare/apexDnsLookup'

describe('isCloudflareEdgeIp', () => {
  it('recognises 104.16.0.0/13 and 104.24.0.0/14', () => {
    expect(isCloudflareEdgeIp('104.16.0.1')).toBe(true)
    expect(isCloudflareEdgeIp('104.21.20.107')).toBe(true)
    expect(isCloudflareEdgeIp('104.23.255.255')).toBe(true)
    expect(isCloudflareEdgeIp('104.24.0.1')).toBe(true)
    expect(isCloudflareEdgeIp('104.27.255.255')).toBe(true)
    // 104.28+ is not a Cloudflare range
    expect(isCloudflareEdgeIp('104.28.0.1')).toBe(false)
  })

  it('recognises 172.64.0.0/13', () => {
    expect(isCloudflareEdgeIp('172.67.192.89')).toBe(true)
    expect(isCloudflareEdgeIp('172.64.0.1')).toBe(true)
    expect(isCloudflareEdgeIp('172.71.255.255')).toBe(true)
  })

  it('recognises 162.158.0.0/15 — the range that was previously missing', () => {
    expect(isCloudflareEdgeIp('162.158.0.1')).toBe(true)
    expect(isCloudflareEdgeIp('162.159.100.200')).toBe(true)
    // 162.160+ is not Cloudflare
    expect(isCloudflareEdgeIp('162.160.0.1')).toBe(false)
  })

  it('recognises 103.x Cloudflare ranges with correct /22 boundaries', () => {
    expect(isCloudflareEdgeIp('103.21.244.1')).toBe(true)
    expect(isCloudflareEdgeIp('103.21.247.255')).toBe(true)
    // 103.21.243 is outside 103.21.244.0/22
    expect(isCloudflareEdgeIp('103.21.243.1')).toBe(false)
    expect(isCloudflareEdgeIp('103.22.200.1')).toBe(true)
    expect(isCloudflareEdgeIp('103.31.4.1')).toBe(true)
  })

  it('recognises 198.41.128.0/17', () => {
    expect(isCloudflareEdgeIp('198.41.128.1')).toBe(true)
    expect(isCloudflareEdgeIp('198.41.255.255')).toBe(true)
    // 198.41.127 is outside /17
    expect(isCloudflareEdgeIp('198.41.127.255')).toBe(false)
  })

  it('rejects non-Cloudflare IPs', () => {
    expect(isCloudflareEdgeIp('8.8.8.8')).toBe(false)
    expect(isCloudflareEdgeIp('192.168.1.1')).toBe(false)
    expect(isCloudflareEdgeIp('1.1.1.1')).toBe(false)
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
