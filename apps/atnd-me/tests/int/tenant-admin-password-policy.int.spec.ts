/**
 * Tenant admins do not choose passwords. A REST write from an org admin, staff
 * member, or location-manager must leave the Payload hash and the Better Auth
 * credential alone. Creating a user asks Better Auth to email a reset link on
 * the tenant host. Creating an email that already exists on another tenant
 * attaches that person instead of inserting a second user.
 */
import crypto from 'crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import { UserAttachedToOrganizationError } from '@/collections/Users/userAttachedToOrganization'
import config from '@/payload.config'
import type { Tenant, User } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

const ORIGINAL_PASSWORD = 'original-secret'
const ADMIN_CHOSEN_PASSWORD = 'admin-chosen-secret'
const SUPER_ADMIN_PASSWORD = 'super-admin-secret'

type CredentialSnapshot = {
  hash: string | null
  salt: string | null
  accountPassword: string | null
}

type ResetCall = {
  body?: { email?: string; redirectTo?: string }
}

type BetterAuthApi = {
  requestPasswordReset?: (input: ResetCall) => Promise<unknown>
}

function tenantHost(slug: string): string {
  return `${slug}.localhost:3000`
}

function restReq(user: User, host: string) {
  return {
    payloadAPI: 'REST' as const,
    user,
    headers: new Headers({
      host,
      'x-forwarded-host': host,
      'x-forwarded-proto': 'https',
    }),
  }
}

async function credentialSnapshot(payload: Payload, userId: number): Promise<CredentialSnapshot> {
  const user = (await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
  })) as { hash?: string | null; salt?: string | null }

  const accounts = await payload.find({
    collection: 'accounts',
    where: {
      and: [{ user: { equals: userId } }, { providerId: { equals: 'credential' } }],
    },
    depth: 0,
    limit: 5,
    overrideAccess: true,
    showHiddenFields: true,
  })
  const account = accounts.docs[0] as { password?: string | null } | undefined

  return {
    hash: user.hash ?? null,
    salt: user.salt ?? null,
    accountPassword: account?.password ?? null,
  }
}

/**
 * Payload local auth and Better Auth's legacy verifier both check this
 * PBKDF2-SHA256 hash (25000 iterations, 512 bytes). `payload.login` is not the
 * member sign-in path here — Better Auth reads `accounts.password`.
 */
function passwordMatchesCredential(password: string, creds: CredentialSnapshot): Promise<boolean> {
  const { hash, salt, accountPassword } = creds
  if (!hash || !salt || accountPassword !== `${salt}:${hash}`) return Promise.resolve(false)
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 25000, 512, 'sha256', (err, derived) => {
      if (err) {
        reject(err)
        return
      }
      const stored = Buffer.from(hash, 'hex')
      resolve(stored.length === derived.length && crypto.timingSafeEqual(stored, derived))
    })
  })
}

function tenantIdsOf(user: { tenants?: unknown }): number[] {
  if (!Array.isArray(user.tenants)) return []
  return user.tenants.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const tenant = (entry as { tenant?: unknown }).tenant
    if (typeof tenant === 'number') return [tenant]
    if (tenant && typeof tenant === 'object' && 'id' in tenant) {
      const id = (tenant as { id: unknown }).id
      return typeof id === 'number' ? [id] : []
    }
    return []
  })
}

function validationMessages(err: unknown): string[] {
  if (!err || typeof err !== 'object') return []
  const data = (err as { data?: { errors?: { message?: unknown }[] } }).data
  const errors = data?.errors
  if (!Array.isArray(errors)) return []
  return errors.flatMap((entry) => (typeof entry?.message === 'string' ? [entry.message] : []))
}

describe('tenant admin password policy', () => {
  let payload: Payload
  let tenantA: Tenant
  let tenantB: Tenant
  let orgAdmin: User
  let orgAdminB: User
  let staff: User
  let member: User
  let superAdmin: User
  let passwordTarget: User
  const ts = Date.now()

  beforeAll(async () => {
    payload = await getPayload({ config: await config })

    tenantA = (await payload.create({
      collection: 'tenants',
      data: { name: 'Password Policy A', slug: `pw-policy-a-${ts}` },
      overrideAccess: true,
    })) as Tenant

    tenantB = (await payload.create({
      collection: 'tenants',
      data: { name: 'Password Policy B', slug: `pw-policy-b-${ts}` },
      overrideAccess: true,
    })) as Tenant

    superAdmin = (await payload.create({
      collection: 'users',
      data: {
        name: 'Password policy super-admin',
        email: `pw-super-${ts}@test.com`,
        password: ORIGINAL_PASSWORD,
        role: ['super-admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    })) as User

    orgAdmin = (await payload.create({
      collection: 'users',
      data: {
        name: 'Org admin A',
        email: `pw-org-a-${ts}@test.com`,
        password: ORIGINAL_PASSWORD,
        role: ['admin'],
        emailVerified: true,
        registrationTenant: tenantA.id,
        tenants: [{ tenant: tenantA.id, roles: ['admin'] }],
      },
      draft: false,
      overrideAccess: true,
    })) as User

    orgAdminB = (await payload.create({
      collection: 'users',
      data: {
        name: 'Org admin B',
        email: `pw-org-b-${ts}@test.com`,
        password: ORIGINAL_PASSWORD,
        role: ['admin'],
        emailVerified: true,
        registrationTenant: tenantB.id,
        tenants: [{ tenant: tenantB.id, roles: ['admin'] }],
      },
      draft: false,
      overrideAccess: true,
    })) as User

    staff = (await payload.create({
      collection: 'users',
      data: {
        name: 'Staff A',
        email: `pw-staff-${ts}@test.com`,
        password: ORIGINAL_PASSWORD,
        role: ['staff'],
        emailVerified: true,
        registrationTenant: tenantA.id,
        tenants: [{ tenant: tenantA.id, roles: ['staff'] }],
      },
      draft: false,
      overrideAccess: true,
    })) as User

    member = (await payload.create({
      collection: 'users',
      data: {
        name: 'Member A',
        email: `pw-member-${ts}@test.com`,
        password: ORIGINAL_PASSWORD,
        role: ['user'],
        emailVerified: true,
        registrationTenant: tenantA.id,
        tenants: [{ tenant: tenantA.id, roles: ['user'] }],
      },
      draft: false,
      overrideAccess: true,
    })) as User

    passwordTarget = (await payload.create({
      collection: 'users',
      data: {
        name: 'Password target',
        email: `pw-target-${ts}@test.com`,
        password: ORIGINAL_PASSWORD,
        role: ['user'],
        emailVerified: true,
        registrationTenant: tenantA.id,
        tenants: [{ tenant: tenantA.id, roles: ['user'] }],
      },
      draft: false,
      overrideAccess: true,
    })) as User
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    await payload?.db?.destroy?.()
  })

  it(
    'leaves hash, salt, and the Better Auth credential unchanged when an org admin sets a password over REST',
    async () => {
      const before = await credentialSnapshot(payload, member.id)
      expect(before.hash).toEqual(expect.any(String))
      expect(before.salt).toEqual(expect.any(String))
      expect(before.accountPassword).toBe(`${before.salt}:${before.hash}`)
      expect(await passwordMatchesCredential(ORIGINAL_PASSWORD, before)).toBe(true)

      const updated = await payload.update({
        collection: 'users',
        id: member.id,
        data: {
          name: 'Member renamed by org admin',
          password: ADMIN_CHOSEN_PASSWORD,
          'confirm-password': ADMIN_CHOSEN_PASSWORD,
        },
        overrideAccess: false,
        user: orgAdmin,
        req: restReq(orgAdmin, tenantHost(tenantA.slug)),
      })

      expect(updated.name).toBe('Member renamed by org admin')

      const after = await credentialSnapshot(payload, member.id)
      expect(after).toEqual(before)
      expect(await passwordMatchesCredential(ORIGINAL_PASSWORD, after)).toBe(true)
      expect(await passwordMatchesCredential(ADMIN_CHOSEN_PASSWORD, after)).toBe(false)
    },
    TEST_TIMEOUT,
  )

  it(
    'leaves a staff member credential unchanged when they set their own password over REST',
    async () => {
      const before = await credentialSnapshot(payload, staff.id)

      const updated = await payload.update({
        collection: 'users',
        id: staff.id,
        data: {
          name: 'Staff renamed',
          password: ADMIN_CHOSEN_PASSWORD,
        },
        overrideAccess: false,
        user: staff,
        req: restReq(staff, tenantHost(tenantA.slug)),
      })

      expect(updated.name).toBe('Staff renamed')
      const after = await credentialSnapshot(payload, staff.id)
      expect(after).toEqual(before)
      expect(await passwordMatchesCredential(ORIGINAL_PASSWORD, after)).toBe(true)
      expect(await passwordMatchesCredential(ADMIN_CHOSEN_PASSWORD, after)).toBe(false)
    },
    TEST_TIMEOUT,
  )

  it(
    'still lets a super-admin set a password over REST',
    async () => {
      const before = await credentialSnapshot(payload, passwordTarget.id)

      await payload.update({
        collection: 'users',
        id: passwordTarget.id,
        data: { password: SUPER_ADMIN_PASSWORD },
        overrideAccess: false,
        user: superAdmin,
        req: restReq(superAdmin, tenantHost(tenantA.slug)),
      })

      const after = await credentialSnapshot(payload, passwordTarget.id)
      expect(after.hash).toEqual(expect.any(String))
      expect(after.hash).not.toBe(before.hash)
      expect(after.accountPassword).toBe(`${after.salt}:${after.hash}`)
      expect(await passwordMatchesCredential(SUPER_ADMIN_PASSWORD, after)).toBe(true)
      expect(await passwordMatchesCredential(ORIGINAL_PASSWORD, after)).toBe(false)
    },
    TEST_TIMEOUT,
  )

  it(
    'ignores the password an org admin submits on create and does not email a reset until they ask',
    async () => {
      const api = (payload as Payload & { betterAuth?: { api?: BetterAuthApi } }).betterAuth?.api
      expect(api?.requestPasswordReset).toEqual(expect.any(Function))
      const original = api!.requestPasswordReset!.bind(api)
      const calls: ResetCall[] = []
      api!.requestPasswordReset = async (input) => {
        calls.push(input)
        return { status: true }
      }

      const email = `pw-created-${ts}@test.com`
      try {
        const created = await payload.create({
          collection: 'users',
          data: {
            name: 'Created by org admin',
            email,
            password: ADMIN_CHOSEN_PASSWORD,
            'confirm-password': ADMIN_CHOSEN_PASSWORD,
            role: ['user'],
            emailVerified: true,
            tenants: [{ tenant: tenantA.id, roles: ['user'] }],
          },
          draft: false,
          overrideAccess: false,
          user: orgAdmin,
          req: restReq(orgAdmin, tenantHost(tenantA.slug)),
        })

        expect(created.email).toBe(email)
        const creds = await credentialSnapshot(payload, created.id as number)
        expect(creds.hash).toEqual(expect.any(String))
        expect(creds.accountPassword).toBe(`${creds.salt}:${creds.hash}`)
        expect(await passwordMatchesCredential(ADMIN_CHOSEN_PASSWORD, creds)).toBe(false)

        expect(calls).toHaveLength(0)
      } finally {
        api!.requestPasswordReset = original
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'attaches an existing user when another tenant admin creates the same email',
    async () => {
      const before = await credentialSnapshot(payload, member.id)
      const email = member.email

      let caught: unknown
      try {
        await payload.create({
          collection: 'users',
          data: {
            name: 'Should not insert',
            email,
            password: ADMIN_CHOSEN_PASSWORD,
            role: ['user'],
            tenants: [{ tenant: tenantB.id, roles: ['user'] }],
          },
          draft: false,
          overrideAccess: false,
          user: orgAdminB,
          req: restReq(orgAdminB, tenantHost(tenantB.slug)),
        })
      } catch (err) {
        caught = err
      }

      expect(caught).toBeInstanceOf(UserAttachedToOrganizationError)
      expect((caught as UserAttachedToOrganizationError).data.userId).toBe(member.id)

      const matches = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        depth: 0,
        limit: 10,
        overrideAccess: true,
      })
      expect(matches.docs).toHaveLength(1)
      expect(matches.docs[0]?.id).toBe(member.id)

      const reloaded = await payload.findByID({
        collection: 'users',
        id: member.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(tenantIdsOf(reloaded)).toEqual(expect.arrayContaining([tenantA.id, tenantB.id]))
      const after = await credentialSnapshot(payload, member.id)
      expect(after).toEqual(before)
      expect(await passwordMatchesCredential(ORIGINAL_PASSWORD, after)).toBe(true)
    },
    TEST_TIMEOUT,
  )
})
