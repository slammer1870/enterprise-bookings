import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createOrGetDomain,
  mapResendStatusToEmailDomainStatus,
  verifyDomain,
  deleteDomain,
} from '../../src/lib/resend/domains'
import {
  resolveEmailSendingDomain,
  resolveTenantBasedBetterAuthFrom,
  emailFromContainsTemplateVars,
  getEmailFromTenantDomainValidationError,
  sanitizeEmailFromForTenantDomain,
} from '../../src/lib/resend/resolveTenantEmailFrom'
import { verifyResendWebhook } from '../../src/lib/resend/webhookVerify'
import { syncTenantEmailDomainFromResend } from '../../src/lib/resend/syncTenantEmailDomain'
import { assertTenantEmailDomainAccess } from '../../src/lib/resend/assertTenantEmailDomainAccess'

const ORIGINAL_ENV = { ...process.env }

describe('mapResendStatusToEmailDomainStatus', () => {
  it('maps Resend statuses', () => {
    expect(mapResendStatusToEmailDomainStatus('verified')).toBe('verified')
    expect(mapResendStatusToEmailDomainStatus('partially_verified')).toBe('verified')
    expect(mapResendStatusToEmailDomainStatus('pending')).toBe('pending')
    expect(mapResendStatusToEmailDomainStatus('not_started')).toBe('not_started')
    expect(mapResendStatusToEmailDomainStatus('failed')).toBe('failed')
    expect(mapResendStatusToEmailDomainStatus('partially_failed')).toBe('failed')
    expect(mapResendStatusToEmailDomainStatus(null)).toBe('not_configured')
  })
})

describe('resolveEmailSendingDomain', () => {
  it('strips leading www for email sending', () => {
    expect(resolveEmailSendingDomain('www.boatyardsauna.ie')).toBe('boatyardsauna.ie')
    expect(resolveEmailSendingDomain('WWW.BoatyardSauna.ie')).toBe('boatyardsauna.ie')
  })

  it('keeps non-www domains as-is', () => {
    expect(resolveEmailSendingDomain('boatyardsauna.ie')).toBe('boatyardsauna.ie')
    expect(resolveEmailSendingDomain('book.studio.example.com')).toBe('book.studio.example.com')
  })
})

describe('resolveTenantBasedBetterAuthFrom', () => {
  it('uses tenant domain only when verified', () => {
    expect(
      resolveTenantBasedBetterAuthFrom({
        tenantName: 'Studio',
        tenantDomain: 'studio.example.com',
        emailDomainVerified: true,
      }),
    ).toEqual({ fromName: 'Studio', fromAddress: 'auth@studio.example.com' })

    expect(
      resolveTenantBasedBetterAuthFrom({
        tenantName: 'Studio',
        tenantDomain: 'studio.example.com',
        emailDomainVerified: false,
      }),
    ).toEqual({ fromName: 'Studio', fromAddress: 'auth@atnd.me' })
  })

  it('sends from apex when website domain is www.*', () => {
    expect(
      resolveTenantBasedBetterAuthFrom({
        tenantName: 'Boatyard',
        tenantDomain: 'www.boatyardsauna.ie',
        emailDomainVerified: true,
      }),
    ).toEqual({ fromName: 'Boatyard', fromAddress: 'auth@boatyardsauna.ie' })
  })
})

describe('sanitizeEmailFromForTenantDomain', () => {
  it('strips From when host matches unverified tenant domain', () => {
    expect(
      sanitizeEmailFromForTenantDomain({
        emailFrom: 'Hello <hello@studio.example.com>',
        tenantDomain: 'studio.example.com',
        emailDomainVerified: false,
      }),
    ).toBeUndefined()
  })

  it('keeps From when host matches verified tenant domain', () => {
    expect(
      sanitizeEmailFromForTenantDomain({
        emailFrom: 'Hello <hello@studio.example.com>',
        tenantDomain: 'studio.example.com',
        emailDomainVerified: true,
      }),
    ).toBe('Hello <hello@studio.example.com>')
  })

  it('strips From for a foreign host even when the tenant domain is verified', () => {
    expect(
      sanitizeEmailFromForTenantDomain({
        emailFrom: 'Hello <hello@other.com>',
        tenantDomain: 'studio.example.com',
        emailDomainVerified: true,
      }),
    ).toBeUndefined()
  })

  it('strips From for a foreign host when the tenant domain is unverified', () => {
    expect(
      sanitizeEmailFromForTenantDomain({
        emailFrom: 'Hello <hello@other.com>',
        tenantDomain: 'studio.example.com',
        emailDomainVerified: false,
      }),
    ).toBeUndefined()
  })

  it('allows apex From when website domain is www-prefixed and verified', () => {
    expect(
      sanitizeEmailFromForTenantDomain({
        emailFrom: 'Studio <hello@studio.example.com>',
        tenantDomain: 'www.studio.example.com',
        emailDomainVerified: true,
      }),
    ).toBe('Studio <hello@studio.example.com>')
  })
})

describe('getEmailFromTenantDomainValidationError', () => {
  it('allows empty and template From values', () => {
    expect(
      getEmailFromTenantDomainValidationError({
        emailFrom: '',
        tenantDomain: 'studio.example.com',
        emailDomainVerified: false,
      }),
    ).toBeNull()

    expect(emailFromContainsTemplateVars('Hello <{{staff.email}}>')).toBe(true)
    expect(
      getEmailFromTenantDomainValidationError({
        emailFrom: 'Hello <{{staff.email}}>',
        tenantDomain: 'studio.example.com',
        emailDomainVerified: false,
      }),
    ).toBeNull()
  })

  it('rejects literal From on an unverified or foreign domain', () => {
    expect(
      getEmailFromTenantDomainValidationError({
        emailFrom: 'hello@studio.example.com',
        tenantDomain: 'studio.example.com',
        emailDomainVerified: false,
      }),
    ).toMatch(/Verify your studio email domain/)

    expect(
      getEmailFromTenantDomainValidationError({
        emailFrom: 'hello@other.com',
        tenantDomain: 'studio.example.com',
        emailDomainVerified: true,
      }),
    ).toMatch(/verified domain/)
  })

  it('allows literal From on the verified tenant domain', () => {
    expect(
      getEmailFromTenantDomainValidationError({
        emailFrom: 'Studio <hello@studio.example.com>',
        tenantDomain: 'studio.example.com',
        emailDomainVerified: true,
      }),
    ).toBeNull()
  })
})

describe('Resend domains API client', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, RESEND_API_KEY: 're_test' }
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('createOrGetDomain creates then returns domain', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'dom_1',
        name: 'studio.example.com',
        status: 'not_started',
        records: [{ type: 'TXT', name: 'send', value: 'v=spf1', status: 'not_started', record: 'SPF', ttl: 'Auto' }],
      }),
    } as any)

    const domain = await createOrGetDomain('studio.example.com')
    expect(domain?.id).toBe('dom_1')
    expect(domain?.records).toHaveLength(1)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/domains',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('createOrGetDomain falls back to list when create conflicts', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: async () => 'already exists',
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'dom_existing', name: 'studio.example.com', status: 'pending' }],
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'dom_existing',
          name: 'studio.example.com',
          status: 'pending',
          records: [],
        }),
      } as any)

    const domain = await createOrGetDomain('studio.example.com')
    expect(domain?.id).toBe('dom_existing')
    expect(domain?.status).toBe('pending')
  })

  it('verifyDomain posts verify then re-fetches', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'dom_1' }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'dom_1',
          name: 'studio.example.com',
          status: 'verified',
          records: [],
        }),
      } as any)

    const domain = await verifyDomain('dom_1')
    expect(domain?.status).toBe('verified')
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/domains/dom_1/verify')
  })

  it('deleteDomain returns true on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as any)
    await expect(deleteDomain('dom_1')).resolves.toBe(true)
  })
})

describe('verifyResendWebhook', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('accepts test signature when ENABLE_TEST_WEBHOOKS', () => {
    process.env.RESEND_WEBHOOK_SECRET = 'test_resend_webhook_secret'
    process.env.ENABLE_TEST_WEBHOOKS = 'true'
    const event = verifyResendWebhook(
      JSON.stringify({ type: 'domain.updated', data: { id: 'd1', status: 'verified' } }),
      { id: 'msg_1', timestamp: '123', signature: 'test' },
    )
    expect(event.type).toBe('domain.updated')
    expect(event.data.status).toBe('verified')
  })

  it('rejects missing secret', () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    expect(() =>
      verifyResendWebhook('{}', { id: '1', timestamp: '1', signature: 'x' }),
    ).toThrow(/RESEND_WEBHOOK_SECRET/)
  })
})

describe('syncTenantEmailDomainFromResend', () => {
  it('updates tenant when status changes and is idempotent', async () => {
    const update = vi.fn(async () => ({}))
    const findByID = vi
      .fn()
      .mockResolvedValueOnce({
        resendDomainId: null,
        emailDomainStatus: 'not_configured',
        emailDomainVerifiedAt: null,
      })
      .mockResolvedValueOnce({
        resendDomainId: 'dom_1',
        emailDomainStatus: 'verified',
        emailDomainVerifiedAt: '2026-01-01T00:00:00.000Z',
      })

    const payload = { findByID, update } as any

    const first = await syncTenantEmailDomainFromResend({
      payload,
      tenantId: 1,
      resendDomainId: 'dom_1',
      resendStatus: 'verified',
    })
    expect(first.emailDomainStatus).toBe('verified')
    expect(update).toHaveBeenCalledTimes(1)

    const second = await syncTenantEmailDomainFromResend({
      payload,
      tenantId: 1,
      resendDomainId: 'dom_1',
      resendStatus: 'verified',
    })
    expect(second.emailDomainStatus).toBe('verified')
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('clears fields on clear: true', async () => {
    const update = vi.fn(async () => ({}))
    const findByID = vi.fn().mockResolvedValue({
      resendDomainId: 'dom_1',
      emailDomainStatus: 'verified',
      emailDomainVerifiedAt: '2026-01-01T00:00:00.000Z',
    })
    const result = await syncTenantEmailDomainFromResend({
      payload: { findByID, update } as any,
      tenantId: 1,
      clear: true,
    })
    expect(result).toEqual({ emailDomainStatus: 'not_configured', resendDomainId: null })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resendDomainId: null,
          emailDomainStatus: 'not_configured',
        }),
      }),
    )
  })

  it('passes req to findByID and update for transaction continuity', async () => {
    const req = { transactionID: 'tx-1' }
    const update = vi.fn(async () => ({}))
    const findByID = vi.fn().mockResolvedValue({
      resendDomainId: null,
      emailDomainStatus: 'not_configured',
      emailDomainVerifiedAt: null,
    })

    await syncTenantEmailDomainFromResend({
      payload: { findByID, update } as any,
      tenantId: 1,
      resendDomainId: 'dom_1',
      resendStatus: 'pending',
      req,
    })

    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ req }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ req }))
  })
})

describe('assertTenantEmailDomainAccess', () => {
  it('forbids tenant-admin for another tenant', async () => {
    const payload = {
      auth: async () => ({
        user: { id: 9, tenants: [{ tenant: 2, roles: ['admin'] }] },
      }),
      findByID: async () => ({
        id: 9,
        tenants: [{ tenant: 2, roles: ['admin'] }],
      }),
    } as any

    // getUserTenantIds may read tenants differently — mock via roles path
    const result = await assertTenantEmailDomainAccess({
      payload,
      headers: new Headers(),
      tenantIdParam: '99',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
    }
  })

  it('allows super-admin any tenantId', async () => {
    const payload = {
      auth: async () => ({
        user: { id: 1, role: ['super-admin'] },
      }),
    } as any

    const result = await assertTenantEmailDomainAccess({
      payload,
      headers: new Headers(),
      tenantIdParam: '42',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.tenantId).toBe(42)
  })
})
