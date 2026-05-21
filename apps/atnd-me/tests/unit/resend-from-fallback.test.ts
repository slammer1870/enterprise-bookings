import { describe, it, expect, vi } from 'vitest'

import { createFromFallbackEmailAdapter } from '../../src/utilities/emailConfig'

describe('Resend from-domain fallback', () => {
  it('retries with fallback adapter when Resend reports unverified from domain (403)', async () => {
    const primarySendEmail = vi.fn(async (_message: any) => {
      throw {
        statusCode: 403,
        name: 'g',
        message: 'The brugrappling.ie domain is not verified. Please, add and verify your domain on https://resend.com/domains',
      }
    })

    const fallbackSendEmail = vi.fn(async (_message: any) => ({ id: 'fallback-email-id' }))

    const primaryAdapter = vi.fn(() => ({
      defaultFromAddress: 'auth@primary.ie',
      defaultFromName: 'Primary',
      name: 'primary',
      sendEmail: primarySendEmail,
    }))

    const fallbackAdapter = vi.fn(() => ({
      defaultFromAddress: 'auth@atnd.ie',
      defaultFromName: 'ATND',
      name: 'fallback',
      sendEmail: fallbackSendEmail,
    }))

    const adapter = createFromFallbackEmailAdapter({ primaryAdapter, fallbackAdapter })

    const initialized = adapter({ payload: {} as any })
    const result = await initialized.sendEmail({
      from: 'Studio Yoga <auth@brugrappling.ie>',
      subject: 'Hello',
      to: ['person@example.com'],
    })

    expect(result).toEqual({ id: 'fallback-email-id' })
    expect(primarySendEmail).toHaveBeenCalledTimes(1)
    expect(fallbackSendEmail).toHaveBeenCalledTimes(1)

    const retriedMessage = fallbackSendEmail.mock.calls[0]?.[0]
    // Adapter retry removes `from` so resendAdapter uses its configured defaults.
    expect(retriedMessage.from).toBeUndefined()
  })

  it('strips malformed from values before sending', async () => {
    const primarySendEmail = vi.fn(async (message: any) => {
      expect(message.from).toBeUndefined()
      return { id: 'normalized-away' }
    })

    const fallbackSendEmail = vi.fn(async (_message: any) => ({ id: 'fallback-email-id' }))

    const primaryAdapter = vi.fn(() => ({
      defaultFromAddress: 'auth@primary.ie',
      defaultFromName: 'Primary',
      name: 'primary',
      sendEmail: primarySendEmail,
    }))

    const fallbackAdapter = vi.fn(() => ({
      defaultFromAddress: 'auth@atnd.ie',
      defaultFromName: 'ATND',
      name: 'fallback',
      sendEmail: fallbackSendEmail,
    }))

    const adapter = createFromFallbackEmailAdapter({ primaryAdapter, fallbackAdapter })

    const initialized = adapter({ payload: {} as any })
    const result = await initialized.sendEmail({
      // This matches the report: Resend rejects `from` when it doesn't include a valid email address.
      from: 'test user or and email address',
      subject: 'Hello',
      to: ['person@example.com'],
    })

    expect(result).toEqual({ id: 'normalized-away' })
    expect(primarySendEmail).toHaveBeenCalledTimes(1)
    expect(fallbackSendEmail).not.toHaveBeenCalled()
  })

  it('extracts a bare email from a malformed from string', async () => {
    const primarySendEmail = vi.fn(async (message: any) => {
      expect(message.from).toBe('person@example.com')
      return { id: 'extracted-email' }
    })

    const fallbackSendEmail = vi.fn(async (_message: any) => ({ id: 'should-not-happen' }))

    const primaryAdapter = vi.fn(() => ({
      defaultFromAddress: 'auth@primary.ie',
      defaultFromName: 'Primary',
      name: 'primary',
      sendEmail: primarySendEmail,
    }))

    const fallbackAdapter = vi.fn(() => ({
      defaultFromAddress: 'auth@atnd.ie',
      defaultFromName: 'ATND',
      name: 'fallback',
      sendEmail: fallbackSendEmail,
    }))

    const adapter = createFromFallbackEmailAdapter({ primaryAdapter, fallbackAdapter })
    const initialized = adapter({ payload: {} as any })

    const result = await initialized.sendEmail({
      // Payload may pass a free-form "from" value; we extract the first email-looking substring.
      from: 'Studio Yoga person@example.com',
      subject: 'Hello',
      to: ['person2@example.com'],
    })

    expect(result).toEqual({ id: 'extracted-email' })
    expect(primarySendEmail).toHaveBeenCalledTimes(1)
    expect(fallbackSendEmail).not.toHaveBeenCalled()
  })

  it('does not retry for 403 errors that are not unverified-from-domain', async () => {
    const primarySendEmail = vi.fn(async (_message: any) => {
      throw { statusCode: 403, message: 'Some other forbidden error' }
    })

    const fallbackSendEmail = vi.fn(async (_message: any) => ({ id: 'should-not-happen' }))

    const primaryAdapter = vi.fn(() => ({
      defaultFromAddress: 'auth@primary.ie',
      defaultFromName: 'Primary',
      name: 'primary',
      sendEmail: primarySendEmail,
    }))

    const fallbackAdapter = vi.fn(() => ({
      defaultFromAddress: 'auth@atnd.ie',
      defaultFromName: 'ATND',
      name: 'fallback',
      sendEmail: fallbackSendEmail,
    }))

    const adapter = createFromFallbackEmailAdapter({ primaryAdapter, fallbackAdapter })
    const initialized = adapter({ payload: {} as any })

    await expect(
      initialized.sendEmail({
        from: 'Studio Yoga <auth@brugrappling.ie>',
        subject: 'Hello',
        to: ['person@example.com'],
      }),
    ).rejects.toBeTruthy()

    expect(fallbackSendEmail).not.toHaveBeenCalled()
  })
})

