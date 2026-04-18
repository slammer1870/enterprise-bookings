import { describe, it, expect } from 'vitest'
import type { Subscription } from '@repo/shared-types'
import { subscriptionBelongsToTenantContext } from '@/blocks/DhLiveMembership/subscription-tenant-context'

describe('subscriptionBelongsToTenantContext', () => {
  const base = {
    id: 1,
    status: 'active' as const,
    user: {} as Subscription['user'],
    plan: {} as Subscription['plan'],
    updatedAt: '',
    createdAt: '',
  }

  it('returns false when subscription.tenant matches the site but plan.tenant does not (no cross-tenant leak)', () => {
    const sub = {
      ...base,
      tenant: 5,
      plan: { ...base.plan, tenant: 99 },
    } as Subscription & { tenant: number; plan: Subscription['plan'] & { tenant: number } }
    expect(subscriptionBelongsToTenantContext(sub, 5)).toBe(false)
    expect(subscriptionBelongsToTenantContext(sub, 99)).toBe(true)
  })

  it('returns true when plan.tenant matches even if subscription.tenant is wrong', () => {
    const sub = {
      ...base,
      tenant: 99,
      plan: { ...base.plan, tenant: 5 },
    } as Subscription & { tenant: number; plan: Subscription['plan'] & { tenant: number } }
    expect(subscriptionBelongsToTenantContext(sub, 5)).toBe(true)
    expect(subscriptionBelongsToTenantContext(sub, 99)).toBe(false)
  })

  it('returns true when only plan.tenant matches (doc tenant missing)', () => {
    const sub = {
      ...base,
      plan: { ...base.plan, tenant: 5 },
    } as Subscription & { plan: Subscription['plan'] & { tenant: number } }
    expect(subscriptionBelongsToTenantContext(sub, 5)).toBe(true)
  })

  it('returns false when only plan.tenant matches a different site', () => {
    const sub = {
      ...base,
      plan: { ...base.plan, tenant: 9 },
    } as Subscription & { plan: Subscription['plan'] & { tenant: number } }
    expect(subscriptionBelongsToTenantContext(sub, 5)).toBe(false)
    expect(subscriptionBelongsToTenantContext(sub, 9)).toBe(true)
  })
})
