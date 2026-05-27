/**
 * Unit tests for the Cloudflare TLS for SaaS custom hostname helper.
 * Mocks globalThis.fetch so no real HTTP calls are made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZONE_ID = 'zone-abc123'
const API_TOKEN = 'cf-token-xyz'

const makeHostnameResponse = (overrides: Partial<{
  id: string
  hostname: string
  status: string
  ownership_verification: { type: string; name: string; value: string }
}> = {}) => ({
  id: 'csh_test123',
  hostname: 'croilan.com',
  status: 'pending',
  ownership_verification: {
    type: 'txt',
    name: '_cf-custom-hostname.croilan.com',
    value: 'txt-token-abc',
  },
  ...overrides,
})

function makeApiResponse(result: unknown, status = 200) {
  return new Response(
    JSON.stringify({ result, success: true, errors: [], messages: [] }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createOrGetCustomHostname', () => {
  const origEnv = process.env
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env = { ...origEnv, CLOUDFLARE_API_TOKEN: API_TOKEN, CLOUDFLARE_ZONE_ID: ZONE_ID }
  })

  afterEach(() => {
    process.env = origEnv
    globalThis.fetch = originalFetch
    vi.resetModules()
  })

  it('creates a new custom hostname and returns id, verificationTxtValue, status', async () => {
    const record = makeHostnameResponse()
    globalThis.fetch = vi.fn().mockResolvedValue(makeApiResponse(record, 200))

    const { createOrGetCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    const result = await createOrGetCustomHostname('croilan.com')

    expect(result.id).toBe('csh_test123')
    expect(result.verificationTxtValue).toBe('txt-token-abc')
    expect(result.status).toBe('pending')

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining(`/zones/${ZONE_ID}/custom_hostnames`),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Bearer ${API_TOKEN}` }),
      }),
    )
  })

  it('returns the existing record when Cloudflare responds 409 (already exists)', async () => {
    const existing = makeHostnameResponse({ id: 'csh_existing', status: 'active' })
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ errors: [{ code: 1414, message: 'hostname already exists' }], success: false }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(makeApiResponse([existing], 200))

    const { createOrGetCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    const result = await createOrGetCustomHostname('croilan.com')

    expect(result.id).toBe('csh_existing')
    expect(result.status).toBe('active')
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2)
  })

  it('throws a descriptive error on non-409 HTTP failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ errors: [{ code: 1000, message: 'Authentication error' }], success: false }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    )

    const { createOrGetCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    await expect(createOrGetCustomHostname('croilan.com')).rejects.toThrow('Cloudflare')
  })

  it('throws when CLOUDFLARE_API_TOKEN is missing', async () => {
    delete process.env.CLOUDFLARE_API_TOKEN

    const { createOrGetCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    await expect(createOrGetCustomHostname('croilan.com')).rejects.toThrow('CLOUDFLARE_API_TOKEN')
  })

  it('throws when CLOUDFLARE_ZONE_ID is missing', async () => {
    delete process.env.CLOUDFLARE_ZONE_ID

    const { createOrGetCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    await expect(createOrGetCustomHostname('croilan.com')).rejects.toThrow('CLOUDFLARE_ZONE_ID')
  })

  it('propagates network errors', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const { createOrGetCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    await expect(createOrGetCustomHostname('croilan.com')).rejects.toThrow('ECONNREFUSED')
  })
})
