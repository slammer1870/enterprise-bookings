import { describe, expect, it } from 'vitest'

import { shouldApplyCancelRefundForActor } from '@/lib/refund-policy/should-apply-cancel-refund'

const studioAdmin = {
  id: 971,
  role: 'admin',
  tenants: [{ tenant: 7, roles: ['user', 'admin'] }],
}

describe('shouldApplyCancelRefundForActor', () => {
  it('does not auto-refund an admin-panel cancel, including the admin’s own booking', () => {
    expect(shouldApplyCancelRefundForActor(studioAdmin)).toBe(false)
  })

  it('applies the refund policy when a customer cancels', () => {
    expect(
      shouldApplyCancelRefundForActor({
        id: 12,
        role: 'user',
        tenants: [{ tenant: 7, roles: ['user'] }],
      }),
    ).toBe(true)
  })

  it('does not refund when nobody is signed in', () => {
    expect(shouldApplyCancelRefundForActor(null)).toBe(false)
  })
})
