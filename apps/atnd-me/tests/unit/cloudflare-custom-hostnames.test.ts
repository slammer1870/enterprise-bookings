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

  it('creates a subdomain custom hostname using http validation by default', async () => {
    const record = makeHostnameResponse({ hostname: 'www.croilan.com' })
    globalThis.fetch = vi.fn().mockResolvedValue(makeApiResponse(record, 200))

    const { createOrGetCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    const result = await createOrGetCustomHostname('www.croilan.com')

    expect(result.id).toBe('csh_test123')
    expect(result.verificationTxtValue).toBe('txt-token-abc')
    expect(result.status).toBe('pending')

    const body = JSON.parse((vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit).body as string)
    expect(body.ssl.method).toBe('http')
  })

  it('creates an apex custom hostname using txt validation when isApex=true', async () => {
    const record = makeHostnameResponse()
    globalThis.fetch = vi.fn().mockResolvedValue(makeApiResponse(record, 200))

    const { createOrGetCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    await createOrGetCustomHostname('croilan.com', true)

    const body = JSON.parse((vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit).body as string)
    expect(body.ssl.method).toBe('txt')
  })

  it('creates a new custom hostname and returns id, verificationTxtValue, status', async () => {
    const record = makeHostnameResponse()
    globalThis.fetch = vi.fn().mockResolvedValue(makeApiResponse(record, 200))

    const { createOrGetCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    const result = await createOrGetCustomHostname('croilan.com', true)

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

  it('PATCHes apex hostnames to txt validation when Cloudflare responds 409', async () => {
    const existing = makeHostnameResponse({ id: 'csh_existing', status: 'pending' })
    const patched = makeHostnameResponse({ id: 'csh_existing', status: 'pending' })
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ errors: [{ code: 1414, message: 'hostname already exists' }], success: false }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ))
      .mockResolvedValueOnce(makeApiResponse([existing], 200))
      .mockResolvedValueOnce(makeApiResponse(patched, 200))

    const { createOrGetCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    await createOrGetCustomHostname('croilan.com', true)

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(3)
    const patchCall = vi.mocked(globalThis.fetch).mock.calls[2]
    expect(patchCall[0]).toContain('/custom_hostnames/csh_existing')
    expect((patchCall[1] as RequestInit).method).toBe('PATCH')
    const patchBody = JSON.parse((patchCall[1] as RequestInit).body as string)
    expect(patchBody.ssl.method).toBe('txt')
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

  it('skips when CLOUDFLARE_API_TOKEN is missing', async () => {
    delete process.env.CLOUDFLARE_API_TOKEN

    const { createOrGetCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    const result = await createOrGetCustomHostname('croilan.com')
    expect(result).toEqual({ id: '', verificationTxtValue: '', status: 'skipped' })
  })

  it('skips when CLOUDFLARE_ZONE_ID is missing', async () => {
    delete process.env.CLOUDFLARE_ZONE_ID

    const { createOrGetCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    const result = await createOrGetCustomHostname('croilan.com')
    expect(result).toEqual({ id: '', verificationTxtValue: '', status: 'skipped' })
  })

  it('propagates network errors', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const { createOrGetCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    await expect(createOrGetCustomHostname('croilan.com')).rejects.toThrow('ECONNREFUSED')
  })
})

describe('deleteCustomHostname', () => {
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

  it('deletes the custom hostname returned by the lookup', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeApiResponse([{ id: 'csh_existing', hostname: 'old.example.com', status: 'active' }], 200),
      )
      .mockResolvedValueOnce(makeApiResponse({ id: 'csh_existing' }, 200))

    const { deleteCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    await deleteCustomHostname('old.example.com')

    const fetchMock = vi.mocked(globalThis.fetch)
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      `/zones/${ZONE_ID}/custom_hostnames?hostname=old.example.com`,
    )
    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/custom_hostnames/csh_existing`,
    )
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'DELETE' }))
  })

  it('succeeds when the hostname is already gone', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeApiResponse([], 200))

    const { deleteCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    await deleteCustomHostname('gone.example.com')

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1)
  })

  it('succeeds when Cloudflare reports the hostname is already deleted', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeApiResponse([{ id: 'csh_existing', hostname: 'old.example.com', status: 'active' }], 200),
      )
      .mockResolvedValueOnce(new Response('', { status: 404 }))

    const { deleteCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    await expect(deleteCustomHostname('old.example.com')).resolves.toBeUndefined()
  })

  it('skips when credentials are missing', async () => {
    delete process.env.CLOUDFLARE_API_TOKEN
    globalThis.fetch = vi.fn()

    const { deleteCustomHostname } = await import('@/lib/cloudflare/customHostnames')
    await deleteCustomHostname('old.example.com')

    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled()
  })
})

describe('getCustomHostnameStatus', () => {
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

  it('returns ssl validation records for apex TXT DCV', async () => {
    const record = {
      ...makeHostnameResponse({ status: 'pending' }),
      ssl: {
        status: 'pending_validation',
        validation_records: [
          {
            status: 'pending',
            txt_name: '_acme-challenge.croilan.com',
            txt_value: 'acme-token-1',
          },
          {
            status: 'pending',
            txt_name: '_acme-challenge.croilan.com',
            txt_value: 'acme-token-2',
          },
        ],
      },
    }
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(makeApiResponse([record], 200))
      .mockResolvedValueOnce(makeApiResponse(record, 200))

    const { getCustomHostnameStatus } = await import('@/lib/cloudflare/customHostnames')
    const status = await getCustomHostnameStatus('croilan.com')

    expect(status).toEqual({
      hostnameStatus: 'pending',
      sslStatus: 'pending',
      rawHostnameStatus: 'pending',
      rawSslStatus: 'pending_validation',
      ownershipTxt: { name: '_cf-custom-hostname.croilan.com', value: 'txt-token-abc' },
      sslValidationRecords: [
        { status: 'pending', name: '_acme-challenge.croilan.com', value: 'acme-token-1' },
        { status: 'pending', name: '_acme-challenge.croilan.com', value: 'acme-token-2' },
      ],
      verificationErrors: [],
    })
  })

  it('omits ownership TXT when Cloudflare has not issued both a name and a value', async () => {
    const record = {
      ...makeHostnameResponse({ status: 'pending' }),
      ownership_verification: { type: 'txt', name: '_cf-custom-hostname.croilan.com', value: '   ' },
    }
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(makeApiResponse([record], 200))
      .mockResolvedValueOnce(makeApiResponse(record, 200))

    const { getCustomHostnameStatus } = await import('@/lib/cloudflare/customHostnames')
    const status = await getCustomHostnameStatus('croilan.com')

    expect(status?.ownershipTxt).toBeNull()
  })

  it('returns verification errors from Cloudflare', async () => {
    const record = {
      ...makeHostnameResponse({ status: 'pending' }),
      verification_errors: [
        'The hostname is using Cloudflare and cannot be activated with an TXT or HTTP validation token.',
      ],
    }
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(makeApiResponse([record], 200))
      .mockResolvedValueOnce(makeApiResponse(record, 200))

    const { getCustomHostnameStatus } = await import('@/lib/cloudflare/customHostnames')
    const status = await getCustomHostnameStatus('croilan.com')

    expect(status?.verificationErrors).toEqual([
      'The hostname is using Cloudflare and cannot be activated with an TXT or HTTP validation token.',
    ])
  })

  it('returns empty ssl validation records when none are present', async () => {
    const record = makeHostnameResponse({ status: 'active' })
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(makeApiResponse([record], 200))
      .mockResolvedValueOnce(makeApiResponse(record, 200))

    const { getCustomHostnameStatus } = await import('@/lib/cloudflare/customHostnames')
    const status = await getCustomHostnameStatus('croilan.com')

    expect(status?.sslValidationRecords).toEqual([])
  })

  it('returns null when credentials are missing', async () => {
    delete process.env.CLOUDFLARE_API_TOKEN

    const { getCustomHostnameStatus } = await import('@/lib/cloudflare/customHostnames')
    const status = await getCustomHostnameStatus('croilan.com')

    expect(status).toBeNull()
  })
})
