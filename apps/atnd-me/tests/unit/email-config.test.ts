import { describe, expect, it } from 'vitest'

import {
  createNoopEmailAdapter,
  resolvePayloadEmailConfig,
  sanitizeFromAddress,
  sanitizeFromName,
  shouldUseNoopEmailAdapter,
} from '../../src/utilities/emailConfig'

describe('payload email config', () => {
  it('transliterates accented from names to ASCII', () => {
    expect(sanitizeFromName('Brú Grappling')).toBe('Bru Grappling')
  })

  it('rejects malformed from names that contain injected env assignments', () => {
    expect(
      sanitizeFromName('ATNDSTRIPE_CONNECT_CLIENT_ID=ca_ToyRWEM489rFH0rlQm7N7rLgHQ1Bjq0I'),
    ).toBeUndefined()
  })

  it('keeps valid from names and addresses', () => {
    expect(sanitizeFromName('ATND')).toBe('ATND')
    expect(sanitizeFromAddress('noreply@atnd.ie')).toBe('noreply@atnd.ie')
  })

  it('rejects malformed from addresses that look like env assignments', () => {
    expect(sanitizeFromAddress('DEFAULT_FROM_ADDRESS=noreply@test.com')).toBeUndefined()
    expect(sanitizeFromAddress('auth@ATNDSTRIPE_CONNECT_CLIENT_ID=ca_xxx')).toBeUndefined()
  })

  it('resolves a safe resend adapter config from env', () => {
    expect(
      resolvePayloadEmailConfig({
        DEFAULT_FROM_ADDRESS: 'noreply@atnd.ie',
        DEFAULT_FROM_NAME: 'ATNDSTRIPE_CONNECT_CLIENT_ID=ca_ToyRWEM489rFH0rlQm7N7rLgHQ1Bjq0I',
        RESEND_API_KEY: 're_test',
      } as NodeJS.ProcessEnv),
    ).toEqual({
      defaultFromAddress: 'noreply@atnd.ie',
      defaultFromName: 'ATND',
      apiKey: 're_test',
    })
  })

  it('uses noop email adapter for e2e / explicit test flags', () => {
    expect(shouldUseNoopEmailAdapter({} as NodeJS.ProcessEnv)).toBe(false)
    expect(shouldUseNoopEmailAdapter({ PW_E2E_PROFILE: 'true' } as NodeJS.ProcessEnv)).toBe(true)
    expect(shouldUseNoopEmailAdapter({ ENABLE_TEST_MAGIC_LINKS: 'true' } as NodeJS.ProcessEnv)).toBe(
      true,
    )
    expect(shouldUseNoopEmailAdapter({ PAYLOAD_TEST_EMAIL: 'noop' } as NodeJS.ProcessEnv)).toBe(true)
  })

  it('noop email adapter resolves sendEmail without throwing', async () => {
    const adapter = createNoopEmailAdapter({
      defaultFromAddress: 'auth@atnd.me',
      defaultFromName: 'ATND',
    })
    const initialized = adapter()
    await expect(initialized.sendEmail()).resolves.toEqual({ id: 'test-email-noop' })
  })
})
