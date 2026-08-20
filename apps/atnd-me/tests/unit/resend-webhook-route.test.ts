import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

describe('POST /api/resend/webhook', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      RESEND_WEBHOOK_SECRET: 'test_resend_webhook_secret',
      ENABLE_TEST_WEBHOOKS: 'true',
      NODE_ENV: 'test',
    }
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  async function loadRoute(mocks: {
    find?: any
    findByID?: any
    update?: any
  }) {
    vi.doMock('@/lib/payload', () => ({
      getPayload: async () => ({
        find: mocks.find || (async () => ({ docs: [] })),
        findByID: mocks.findByID || (async () => null),
        update: mocks.update || (async () => ({})),
      }),
    }))
    return import('../../src/app/api/resend/webhook/route')
  }

  it('rejects invalid signature', async () => {
    const { POST } = await loadRoute({})
    const req = new Request('http://localhost/api/resend/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'domain.updated', data: { id: 'd1', status: 'verified' } }),
      headers: {
        'svix-id': '1',
        'svix-timestamp': '1',
        'svix-signature': 'bad',
      },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('never accepts the test signature in production', async () => {
    process.env.NODE_ENV = 'production'
    vi.resetModules()
    const { POST } = await loadRoute({})

    const req = new Request('http://localhost/api/resend/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'domain.updated', data: { id: 'd1', status: 'verified' } }),
      headers: {
        'svix-id': '1',
        'svix-timestamp': '1',
        'svix-signature': 'test',
      },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('promotes on domain.updated verified', async () => {
    const update = vi.fn(async () => ({}))
    const find = vi.fn(async () => ({ docs: [{ id: 7 }] }))
    const findByID = vi.fn(async () => ({
      resendDomainId: 'd1',
      emailDomainStatus: 'pending',
      emailDomainVerifiedAt: null,
    }))
    const { POST } = await loadRoute({ find, findByID, update })

    const req = new Request('http://localhost/api/resend/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'domain.updated', data: { id: 'd1', status: 'verified' } }),
      headers: {
        'svix-id': '1',
        'svix-timestamp': '1',
        'svix-signature': 'test',
      },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('verified')
    expect(update).toHaveBeenCalled()
  })

  it('treats domain.verified as verified', async () => {
    const update = vi.fn(async () => ({}))
    const find = vi.fn(async () => ({ docs: [{ id: 7 }] }))
    const findByID = vi.fn(async () => ({
      resendDomainId: 'd1',
      emailDomainStatus: 'pending',
      emailDomainVerifiedAt: null,
    }))
    const { POST } = await loadRoute({ find, findByID, update })

    const req = new Request('http://localhost/api/resend/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'domain.verified', data: { id: 'd1' } }),
      headers: {
        'svix-id': '1',
        'svix-timestamp': '1',
        'svix-signature': 'test',
      },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('verified')
  })

  it('clears on domain.deleted', async () => {
    const update = vi.fn(async () => ({}))
    const find = vi.fn(async () => ({ docs: [{ id: 7 }] }))
    const findByID = vi.fn(async () => ({
      resendDomainId: 'd1',
      emailDomainStatus: 'verified',
      emailDomainVerifiedAt: '2026-01-01T00:00:00.000Z',
    }))
    const { POST } = await loadRoute({ find, findByID, update })

    const req = new Request('http://localhost/api/resend/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'domain.deleted', data: { id: 'd1', status: 'not_started' } }),
      headers: {
        'svix-id': '1',
        'svix-timestamp': '1',
        'svix-signature': 'test',
      },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.cleared).toBe(true)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailDomainStatus: 'not_configured' }),
      }),
    )
  })

  it('demotes on domain.updated failed', async () => {
    const update = vi.fn(async () => ({}))
    const find = vi.fn(async () => ({ docs: [{ id: 7 }] }))
    const findByID = vi.fn(async () => ({
      resendDomainId: 'd1',
      emailDomainStatus: 'verified',
      emailDomainVerifiedAt: '2026-01-01T00:00:00.000Z',
    }))
    const { POST } = await loadRoute({ find, findByID, update })

    const req = new Request('http://localhost/api/resend/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'domain.updated', data: { id: 'd1', status: 'failed' } }),
      headers: {
        'svix-id': '1',
        'svix-timestamp': '1',
        'svix-signature': 'test',
      },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('failed')
  })
})
