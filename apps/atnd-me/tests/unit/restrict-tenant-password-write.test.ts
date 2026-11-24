import { describe, expect, it, vi } from 'vitest'
import { APIError, type PayloadRequest } from 'payload'

import { Users } from '../../src/collections/Users'
import { fixBetterAuthAfterReadHooks } from '../../src/plugins/fix-better-auth-after-read-hooks'
import {
  ATND_FORCED_PASSWORD,
  ATND_FORCE_SET_OWN_PASSWORD,
  canSetUserPassword,
  restoreForcedPasswordOnCreate,
  restrictTenantPasswordWrite,
} from '../../src/collections/Users/restrictTenantPasswordWrite'
import { sendSetPasswordResetEmail } from '../../src/collections/Users/sendSetPasswordEmail'

const tenantAdmin = { id: 2, tenants: [{ tenant: 7, roles: ['admin'] }] }
const staff = { id: 3, tenants: [{ tenant: 7, roles: ['staff'] }] }
const locationManager = { id: 4, tenants: [{ tenant: 7, roles: ['location-manager'] }] }
const superAdmin = { id: 1, role: ['super-admin'] }

function reqFor(
  user: unknown,
  payloadAPI: 'REST' | 'GraphQL' | 'local',
): PayloadRequest {
  return {
    user,
    payloadAPI,
    context: {},
    headers: new Headers({
      host: 'acme.atnd-me.com',
      'x-forwarded-proto': 'https',
    }),
    payload: { logger: { error: vi.fn() } },
  } as unknown as PayloadRequest
}

describe('restrictTenantPasswordWrite', () => {
  it('drops a tenant-admin password on update so hash and salt are not rewritten', () => {
    const req = reqFor(tenantAdmin, 'REST')
    const args = restrictTenantPasswordWrite({
      args: {
        data: {
          name: 'Member',
          password: 'ChosenByAdmin1',
          'confirm-password': 'ChosenByAdmin1',
        },
      },
      operation: 'update',
      req,
    })

    expect(args.data).not.toHaveProperty('password')
    expect(args.data).not.toHaveProperty('confirm-password')
    expect(args.data?.name).toBe('Member')
  })

  it('drops staff and location-manager passwords on update, including their own user', () => {
    for (const user of [staff, locationManager]) {
      const args = restrictTenantPasswordWrite({
        args: { data: { password: 'NewSecret1', passwordConfirm: 'NewSecret1' } },
        operation: 'update',
        req: reqFor(user, 'REST'),
      })
      expect(args.data).not.toHaveProperty('password')
      expect(args.data).not.toHaveProperty('passwordConfirm')
    }
  })

  it('drops a GraphQL password update from a tenant admin', () => {
    const args = restrictTenantPasswordWrite({
      args: { data: { password: 'NewSecret1' } },
      operation: 'update',
      req: reqFor(tenantAdmin, 'GraphQL'),
    })
    expect(args.data).not.toHaveProperty('password')
  })

  it('keeps a super-admin password update', () => {
    const args = restrictTenantPasswordWrite({
      args: { data: { password: 'PlatformOps1' } },
      operation: 'update',
      req: reqFor(superAdmin, 'REST'),
    })
    expect(args.data?.password).toBe('PlatformOps1')
  })

  it('keeps an anonymous signup password', () => {
    const anonymous = restrictTenantPasswordWrite({
      args: { data: { password: 'SignupSecret1' } },
      operation: 'create',
      req: reqFor(null, 'REST'),
    })
    expect(anonymous.data?.password).toBe('SignupSecret1')
  })

  it('replaces a Local API create password for tenant roles so field access strip still leaves a stand-in', () => {
    const req = reqFor(tenantAdmin, 'local')
    const args = restrictTenantPasswordWrite({
      args: { data: { password: 'SeedSecret1' } },
      operation: 'create',
      req,
    })
    expect(args.data?.password).not.toBe('SeedSecret1')
    expect(String(args.data?.password).length).toBeGreaterThanOrEqual(32)
    expect((req.context as Record<string, unknown>)[ATND_FORCE_SET_OWN_PASSWORD]).toBe(true)

    const forced = args.data?.password
    delete args.data?.password
    const restored = restoreForcedPasswordOnCreate({
      data: args.data,
      operation: 'create',
      req,
    })
    expect(restored?.password).toBe(forced)
  })

  it('replaces a tenant-admin create password and restores it after field access strips it', () => {
    const req = reqFor(tenantAdmin, 'REST')
    const args = restrictTenantPasswordWrite({
      args: {
        data: {
          email: 'new@example.com',
          password: 'ChosenByAdmin1',
          'confirm-password': 'ChosenByAdmin1',
        },
      },
      operation: 'create',
      req,
    })

    expect(args.data?.password).not.toBe('ChosenByAdmin1')
    expect(String(args.data?.password).length).toBeGreaterThanOrEqual(32)
    expect(args.data).not.toHaveProperty('confirm-password')
    expect((req.context as Record<string, unknown>)[ATND_FORCE_SET_OWN_PASSWORD]).toBe(true)

    const forced = args.data?.password
    delete args.data?.password
    const restored = restoreForcedPasswordOnCreate({
      data: args.data,
      operation: 'create',
      req,
    })
    expect(restored?.password).toBe(forced)
    expect((req.context as Record<string, unknown>)[ATND_FORCED_PASSWORD]).toBeUndefined()
  })

  it('does not replace the stand-in password if the hook runs twice', () => {
    const req = reqFor(staff, 'REST')
    const first = restrictTenantPasswordWrite({
      args: { data: { password: 'ChosenByAdmin1' } },
      operation: 'create',
      req,
    })
    const standIn = first.data?.password
    const second = restrictTenantPasswordWrite({
      args: first,
      operation: 'create',
      req,
    })
    expect(second.data?.password).toBe(standIn)
  })
})

describe('canSetUserPassword', () => {
  it('denies tenant roles on every API, including Local (admin permission checks use Local)', () => {
    expect(canSetUserPassword({ user: tenantAdmin })).toBe(false)
    expect(canSetUserPassword({ user: tenantAdmin, payloadAPI: 'REST' })).toBe(false)
    // Payload createLocalReq sets payloadAPI to `local` for admin field permissions.
    // Allowing Local here made password.create true for tenant admins on the create form.
    expect(canSetUserPassword({ user: tenantAdmin, payloadAPI: 'local' })).toBe(false)
    expect(canSetUserPassword({ user: staff, payloadAPI: 'local' })).toBe(false)
    expect(canSetUserPassword({ user: locationManager, payloadAPI: 'local' })).toBe(false)
    expect(canSetUserPassword({ user: staff })).toBe(false)
    expect(canSetUserPassword({ user: locationManager })).toBe(false)
    expect(canSetUserPassword({ user: superAdmin })).toBe(true)
    expect(canSetUserPassword({ user: superAdmin, payloadAPI: 'local' })).toBe(true)
    expect(
      canSetUserPassword({
        user: { id: 1, role: ['super-admin'], tenants: [{ tenant: 7, roles: ['admin'] }] },
        payloadAPI: 'REST',
      }),
    ).toBe(true)
    expect(
      canSetUserPassword({ user: { id: 5, role: ['admin'] }, payloadAPI: 'REST' }),
    ).toBe(false)
    // Seeds / claim / anonymous signup: no signed-in actor → password allowed.
    expect(canSetUserPassword({ user: null })).toBe(true)
    expect(canSetUserPassword({ user: null, payloadAPI: 'local' })).toBe(true)
    expect(canSetUserPassword(undefined)).toBe(true)
  })
})

describe('sendSetPasswordResetEmail', () => {
  it('asks Better Auth to email a reset link on the request host', async () => {
    const requestPasswordReset = vi.fn(async () => ({ status: true }))
    const req = reqFor(tenantAdmin, 'REST')
    req.payload = {
      logger: { error: vi.fn() },
      betterAuth: { api: { requestPasswordReset } },
    } as unknown as PayloadRequest['payload']

    await sendSetPasswordResetEmail({
      email: 'new@example.com',
      req,
      userId: '9',
    })

    expect(requestPasswordReset).toHaveBeenCalledOnce()
    expect(requestPasswordReset.mock.calls[0]?.[0]).toEqual({
      body: {
        email: 'new@example.com',
        redirectTo: 'https://acme.atnd-me.com/auth/reset-password',
      },
      headers: req.headers,
    })
  })

  it('throws when Better Auth reports that it did not email the account', async () => {
    const req = reqFor(tenantAdmin, 'REST')
    req.payload = {
      logger: { error: vi.fn() },
      betterAuth: {
        api: {
          requestPasswordReset: vi.fn(async () => ({
            status: true,
            message: 'If this email exists in our system, check your email for the reset link',
          })),
        },
      },
    } as unknown as PayloadRequest['payload']

    await expect(
      sendSetPasswordResetEmail({
        email: 'missing@example.com',
        req,
        userId: '4',
      }),
    ).rejects.toBeInstanceOf(APIError)
  })

  it('throws when the reset email throws, without logging the address', async () => {
    const req = reqFor(tenantAdmin, 'REST')
    const error = vi.fn()
    req.payload = {
      logger: { error },
      betterAuth: {
        api: {
          requestPasswordReset: vi.fn(async () => {
            throw new Error('smtp down')
          }),
        },
      },
    } as unknown as PayloadRequest['payload']

    await expect(
      sendSetPasswordResetEmail({
        email: 'new@example.com',
        req,
        userId: '4',
      }),
    ).rejects.toBeInstanceOf(APIError)
    expect(error).toHaveBeenCalled()
    expect(JSON.stringify(error.mock.calls)).toContain('smtp down')
    expect(JSON.stringify(error.mock.calls)).not.toContain('new@example.com')
  })

  it('throws when the auth API cannot send a reset', async () => {
    const req = reqFor(tenantAdmin, 'REST')
    req.payload = {
      logger: { error: vi.fn() },
      betterAuth: { api: {} },
    } as unknown as PayloadRequest['payload']

    await expect(
      sendSetPasswordResetEmail({
        email: 'new@example.com',
        req,
        userId: '4',
      }),
    ).rejects.toBeInstanceOf(APIError)
  })
})

describe('Users password policy wiring', () => {
  it('declares a virtual password field whose write access follows canSetUserPassword', () => {
    const field = Users.fields.find((f) => 'name' in f && f.name === 'password')
    expect(field).toMatchObject({
      name: 'password',
      type: 'text',
      virtual: true,
    })
    expect(field && 'access' in field && field.access?.update?.({ req: reqFor(tenantAdmin, 'REST') })).toBe(
      false,
    )
    expect(field && 'access' in field && field.access?.update?.({ req: reqFor(superAdmin, 'REST') })).toBe(
      true,
    )
    expect(field && 'access' in field && field.access?.create?.({ req: reqFor(tenantAdmin, 'local') })).toBe(
      false,
    )
    expect(field && 'access' in field && field.access?.create?.({ req: reqFor(superAdmin, 'local') })).toBe(
      true,
    )
  })

  it('strips the password on the hook payload-auth actually keeps', async () => {
    const plugin = fixBetterAuthAfterReadHooks()
    const config = plugin({
      collections: [
        {
          slug: 'users',
          fields: [],
          hooks: {},
        },
      ],
    } as never)

    const users = config.collections?.find((c) => c.slug === 'users')
    const before = users?.hooks?.beforeOperation ?? []
    expect(before.length).toBeGreaterThan(0)

    let args: { data?: Record<string, unknown> } = {
      data: { name: 'Member', password: 'ChosenByAdmin1', 'confirm-password': 'ChosenByAdmin1' },
    }
    for (const hook of before) {
      args = (await hook({
        args,
        operation: 'update',
        req: reqFor(tenantAdmin, 'REST'),
      } as never)) as { data?: Record<string, unknown> }
    }

    expect(args.data).not.toHaveProperty('password')
    expect(args.data).not.toHaveProperty('confirm-password')
  })

  it('does not send a set-password email from afterChange', async () => {
    const plugin = fixBetterAuthAfterReadHooks()
    const config = plugin({
      collections: [
        {
          slug: 'users',
          fields: [],
          hooks: {
            afterChange: [async ({ doc }: { doc: unknown }) => doc],
          },
        },
      ],
    } as never)

    const after =
      config.collections?.find((c) => c.slug === 'users')?.hooks?.afterChange ?? []
    expect(after).toHaveLength(1)

    const requestPasswordReset = vi.fn(async () => ({ status: true }))
    const req = reqFor(tenantAdmin, 'REST')
    ;(req.context as Record<string, unknown>)[ATND_FORCE_SET_OWN_PASSWORD] = true
    req.payload = {
      logger: { error: vi.fn() },
      betterAuth: { api: { requestPasswordReset } },
    } as unknown as PayloadRequest['payload']

    await after[0]!({
      doc: { id: 3, email: 'new@example.com' },
      operation: 'create',
      req,
    } as never)

    expect(requestPasswordReset).not.toHaveBeenCalled()
  })

  it('exposes a set-password email endpoint and a button in the password slot', () => {
    expect(Users.endpoints?.map((endpoint) => endpoint.path)).toContain(
      '/:id/send-set-password-email',
    )
    const field = Users.fields.find((f) => 'name' in f && f.name === 'sendSetPasswordEmail')
    expect(field).toMatchObject({
      name: 'sendSetPasswordEmail',
      type: 'ui',
    })
  })
})
