import { describe, expect, it } from 'vitest'

import { resolvePayloadEmailConfig, sanitizeFromAddress, sanitizeFromName } from '../../src/utilities/emailConfig'

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
})
