import { describe, expect, it, vi } from 'vitest'

import { Users } from '../../src/collections/Users'
import {
  allowBlankPassword,
  relaxPasswordField,
} from '../../src/components/admin/users/relaxPasswordField'
import { viewerChoosesUserPassword } from '../../src/components/admin/users/viewerChoosesUserPassword'

describe('viewerChoosesUserPassword', () => {
  it('lets a super-admin type a password and omits it for tenant membership roles', () => {
    expect(viewerChoosesUserPassword({ id: 1, role: ['super-admin'] })).toBe(true)
    expect(
      viewerChoosesUserPassword({
        id: 1,
        role: ['super-admin'],
        tenants: [{ tenant: 7, roles: ['admin'] }],
      }),
    ).toBe(true)
    expect(
      viewerChoosesUserPassword({
        id: 2,
        role: ['user'],
        tenants: [{ tenant: 7, roles: ['admin'] }],
      }),
    ).toBe(false)
    expect(viewerChoosesUserPassword({ id: 3, tenants: [{ tenant: 7, roles: ['staff'] }] })).toBe(
      false,
    )
    expect(
      viewerChoosesUserPassword({
        id: 4,
        tenants: [{ tenant: 7, roles: ['location-manager'] }],
      }),
    ).toBe(false)
    // Shallow admin session: memberships omitted, derived global role remains.
    expect(viewerChoosesUserPassword({ id: 5, role: ['admin'] })).toBe(false)
    expect(viewerChoosesUserPassword({ id: 6, role: 'staff' })).toBe(false)
    expect(viewerChoosesUserPassword(null)).toBe(true)
  })
})

describe('relaxPasswordField', () => {
  it('clears the required error Payload puts on the auth password inputs', () => {
    const dispatch = vi.fn()
    relaxPasswordField(dispatch, 'password', {
      valid: false,
      errorMessage: 'This field is required',
      validate: () => 'This field is required',
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE',
      path: 'password',
      valid: true,
      errorMessage: undefined,
      validate: allowBlankPassword,
    })
  })

  it('does not dispatch once the field already accepts a blank password', () => {
    const dispatch = vi.fn()
    relaxPasswordField(dispatch, 'confirm-password', {
      valid: true,
      errorMessage: undefined,
      validate: allowBlankPassword,
    })
    expect(dispatch).not.toHaveBeenCalled()
  })
})

describe('Users create form password', () => {
  it('always mounts the omit field so the logged-in admin, not the empty document, decides', () => {
    const field = Users.fields.find((f) => 'name' in f && f.name === 'omitChosenPassword')
    expect(field).toMatchObject({
      name: 'omitChosenPassword',
      type: 'ui',
    })
    expect(field && 'admin' in field ? field.admin?.condition : undefined).toBeUndefined()
    const emailField = Users.fields.find((f) => 'name' in f && f.name === 'sendSetPasswordEmail')
    const condition =
      emailField && 'admin' in emailField ? emailField.admin?.condition : undefined
    expect(
      condition?.(
        {},
        {},
        { operation: 'update', user: { id: 2, tenants: [{ tenant: 7, roles: ['admin'] }] } } as never,
      ),
    ).toBe(true)
    expect(
      condition?.({}, {}, { operation: 'update', user: { id: 1, role: ['super-admin'] } } as never),
    ).toBe(false)
    expect(
      condition?.({}, {}, { operation: 'create', user: { id: 2, role: ['admin'] } } as never),
    ).toBe(false)
  })
})
