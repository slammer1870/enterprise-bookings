import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APIError, type PayloadRequest } from 'payload'

vi.mock('@/access/userTenantAccess', async () => {
  const actual = await vi.importActual<typeof import('@/access/userTenantAccess')>(
    '@/access/userTenantAccess',
  )
  return {
    ...actual,
    userTenantUpdate: vi.fn(),
  }
})

import { userTenantUpdate } from '@/access/userTenantAccess'
import { sendSetPasswordEmailForUser } from '../../src/collections/Users/sendSetPasswordEmail'
import { shouldShowSetPasswordEmailButton } from '../../src/components/admin/users/shouldShowSetPasswordEmailButton'

const tenantAdmin = { id: 2, tenants: [{ tenant: 7, roles: ['admin'] }] }

function reqFor(): PayloadRequest & {
  payload: {
    find: ReturnType<typeof vi.fn>
    logger: { error: ReturnType<typeof vi.fn> }
    betterAuth: { api: { requestPasswordReset: ReturnType<typeof vi.fn> } }
  }
} {
  const requestPasswordReset = vi.fn(async () => ({ status: true }))
  return {
    user: tenantAdmin,
    payloadAPI: 'REST',
    context: {},
    headers: new Headers({
      host: 'acme.atnd-me.com',
      'x-forwarded-proto': 'https',
    }),
    payload: {
      find: vi.fn(),
      logger: { error: vi.fn() },
      betterAuth: { api: { requestPasswordReset } },
    },
  } as unknown as PayloadRequest & {
    payload: {
      find: ReturnType<typeof vi.fn>
      logger: { error: ReturnType<typeof vi.fn> }
      betterAuth: { api: { requestPasswordReset: ReturnType<typeof vi.fn> } }
    }
  }
}

describe('sendSetPasswordEmailForUser', () => {
  beforeEach(() => {
    userTenantUpdate.mockReset()
  })

  it('refuses an anonymous caller', async () => {
    const req = reqFor()
    req.user = null
    await expect(sendSetPasswordEmailForUser(req, 9)).rejects.toMatchObject({ status: 401 })
    expect(req.payload.betterAuth.api.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('refuses a caller who cannot update the user', async () => {
    userTenantUpdate.mockResolvedValue(false)
    const req = reqFor()
    await expect(sendSetPasswordEmailForUser(req, 9)).rejects.toMatchObject({ status: 403 })
    expect(req.payload.find).not.toHaveBeenCalled()
    expect(req.payload.betterAuth.api.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('refuses when the user is outside the caller update scope', async () => {
    userTenantUpdate.mockResolvedValue({ 'tenants.tenant': { in: [7] } })
    const req = reqFor()
    req.payload.find.mockResolvedValue({ docs: [] })

    await expect(sendSetPasswordEmailForUser(req, '9')).rejects.toMatchObject({ status: 403 })
    expect(req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        overrideAccess: false,
        where: {
          and: [{ id: { equals: 9 } }, { 'tenants.tenant': { in: [7] } }],
        },
      }),
    )
    expect(req.payload.betterAuth.api.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('emails the saved address through Better Auth when the caller can update the user', async () => {
    userTenantUpdate.mockResolvedValue(true)
    const req = reqFor()
    req.payload.find.mockResolvedValue({ docs: [{ id: 9, email: ' member@example.com ' }] })

    await sendSetPasswordEmailForUser(req, 9)

    expect(req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        overrideAccess: false,
        req,
        where: { id: { equals: 9 } },
      }),
    )
    expect(req.payload.betterAuth.api.requestPasswordReset).toHaveBeenCalledWith({
      body: {
        email: 'member@example.com',
        redirectTo: 'https://acme.atnd-me.com',
      },
      headers: req.headers,
    })
  })

  it('does not email when the account has no address', async () => {
    userTenantUpdate.mockResolvedValue(true)
    const req = reqFor()
    req.payload.find.mockResolvedValue({ docs: [{ id: 9, email: '  ' }] })

    await expect(sendSetPasswordEmailForUser(req, 9)).rejects.toBeInstanceOf(APIError)
    expect(req.payload.betterAuth.api.requestPasswordReset).not.toHaveBeenCalled()
  })
})

describe('shouldShowSetPasswordEmailButton', () => {
  const viewer = { id: 3, tenants: [{ tenant: 7, roles: ['staff'] }] }

  it('hides the button when update access is omitted', () => {
    expect(
      shouldShowSetPasswordEmailButton({
        user: viewer,
        docId: '9',
        updatePermission: undefined,
      }),
    ).toBe(false)
  })

  it('hides the button when update access is false', () => {
    expect(
      shouldShowSetPasswordEmailButton({
        user: viewer,
        docId: '9',
        updatePermission: false,
      }),
    ).toBe(false)
  })

  it('shows the button when update is allowed, including a where constraint', () => {
    expect(
      shouldShowSetPasswordEmailButton({
        user: viewer,
        docId: '9',
        updatePermission: true,
      }),
    ).toBe(true)
    expect(
      shouldShowSetPasswordEmailButton({
        user: viewer,
        docId: '9',
        updatePermission: { id: { equals: 9 } },
      }),
    ).toBe(true)
  })

  it('hides the button for a super-admin and when the document has no id', () => {
    expect(
      shouldShowSetPasswordEmailButton({
        user: { id: 1, role: ['super-admin'] },
        docId: '9',
        updatePermission: true,
      }),
    ).toBe(false)
    expect(
      shouldShowSetPasswordEmailButton({
        user: viewer,
        docId: '',
        updatePermission: true,
      }),
    ).toBe(false)
  })
})
