import { describe, it, expect } from 'vitest'
import { createBetterAuthOptions } from '@repo/better-auth-config/server'

function makeConfig(baseURL: string) {
  return {
    appName: 'ATND ME',
    baseURL,
    trustedOrigins: [baseURL],
    adminUserIds: ['1'],
    disableDefaultPayloadAuth: false,
    hidePluginCollections: true,
    enableMagicLink: true,
    roles: {
      adminRoles: ['admin', 'tenant-admin'],
      defaultRole: 'user',
      defaultAdminRole: 'admin',
      roles: ['user', 'admin', 'tenant-admin'],
      allowedFields: ['name'],
    },
  }
}

describe('Better Auth cookie domain derivation', () => {
  it('uses full hostname for atnd-me.com (not .me.com)', () => {
    const opts: any = createBetterAuthOptions(makeConfig('https://atnd-me.com'))
    expect(opts.advanced.defaultCookieAttributes.domain).toBe('.atnd-me.com')
    expect(opts.advanced.cookies.session_token.attributes.domain).toBe('.atnd-me.com')
    expect(opts.advanced.cookies.session_data.attributes.domain).toBe('.atnd-me.com')
  })

  it('scopes to stage hostname when baseURL has a subdomain', () => {
    const opts: any = createBetterAuthOptions(makeConfig('https://stage.atnd-me.com'))
    expect(opts.advanced.defaultCookieAttributes.domain).toBe('.stage.atnd-me.com')
  })

  it('omits domain for localhost', () => {
    const opts: any = createBetterAuthOptions(makeConfig('http://localhost:3000'))
    expect(opts.advanced.defaultCookieAttributes.domain).toBeUndefined()
    expect(opts.advanced.cookies.session_token.attributes.domain).toBeUndefined()
  })
})

