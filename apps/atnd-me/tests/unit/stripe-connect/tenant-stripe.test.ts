import { describe, expect, it } from 'vitest'
import {
  getTenantStripeContext,
  requireTenantConnectAccount,
  TenantNotConnectedError,
} from '@/lib/stripe-connect/tenantStripe'

type TenantLike = {
  stripeConnectAccountId?: string | null
  stripeConnectOnboardingStatus?: 'not_connected' | 'pending' | 'active' | 'restricted' | 'deauthorized' | null
}

describe('Tenant-aware Stripe helpers (step 2.2)', () => {
  describe('getTenantStripeContext', () => {
    it('returns isConnected false and no accountId when tenant has no Stripe account', () => {
      const tenant: TenantLike = { stripeConnectAccountId: null, stripeConnectOnboardingStatus: 'not_connected' }
      const ctx = getTenantStripeContext(tenant)
      expect(ctx.isConnected).toBe(false)
      expect(ctx.accountId).toBeUndefined()
      expect(ctx.requiresOnboarding).toBe(false)
    })

    it('returns isConnected true, accountId, and requiresOnboarding false when status is active', () => {
      const tenant: TenantLike = {
        stripeConnectAccountId: 'acct_abc123',
        stripeConnectOnboardingStatus: 'active',
      }
      const ctx = getTenantStripeContext(tenant)
      expect(ctx.isConnected).toBe(true)
      expect(ctx.accountId).toBe('acct_abc123')
      expect(ctx.requiresOnboarding).toBe(false)
    })

    it('returns isConnected false and requiresOnboarding true when status is pending', () => {
      const tenant: TenantLike = {
        stripeConnectAccountId: 'acct_xyz',
        stripeConnectOnboardingStatus: 'pending',
      }
      const ctx = getTenantStripeContext(tenant)
      expect(ctx.isConnected).toBe(false)
      expect(ctx.accountId).toBeUndefined()
      expect(ctx.requiresOnboarding).toBe(true)
    })

    it('returns isConnected false and requiresOnboarding true when status is restricted', () => {
      const tenant: TenantLike = {
        stripeConnectAccountId: 'acct_restricted',
        stripeConnectOnboardingStatus: 'restricted',
      }
      const ctx = getTenantStripeContext(tenant)
      expect(ctx.isConnected).toBe(false)
      expect(ctx.requiresOnboarding).toBe(true)
    })

    it('returns isConnected false when status is deauthorized even with account id', () => {
      const tenant: TenantLike = {
        stripeConnectAccountId: 'acct_old',
        stripeConnectOnboardingStatus: 'deauthorized',
      }
      const ctx = getTenantStripeContext(tenant)
      expect(ctx.isConnected).toBe(false)
      expect(ctx.requiresOnboarding).toBe(false)
    })
  })

  describe('requireTenantConnectAccount', () => {
    it('does not throw when tenant is connected (active)', () => {
      const tenant: TenantLike = {
        stripeConnectAccountId: 'acct_ok',
        stripeConnectOnboardingStatus: 'active',
      }
      expect(() => requireTenantConnectAccount(tenant)).not.toThrow()
    })

    it('throws TenantNotConnectedError when tenant has no account', () => {
      const tenant: TenantLike = { stripeConnectAccountId: null, stripeConnectOnboardingStatus: 'not_connected' }
      expect(() => requireTenantConnectAccount(tenant)).toThrow(TenantNotConnectedError)
    })

    it('throws TenantNotConnectedError when status is pending', () => {
      const tenant: TenantLike = {
        stripeConnectAccountId: 'acct_pending',
        stripeConnectOnboardingStatus: 'pending',
      }
      expect(() => requireTenantConnectAccount(tenant)).toThrow(TenantNotConnectedError)
    })

    it('throws TenantNotConnectedError when status is restricted', () => {
      const tenant: TenantLike = {
        stripeConnectAccountId: 'acct_r',
        stripeConnectOnboardingStatus: 'restricted',
      }
      expect(() => requireTenantConnectAccount(tenant)).toThrow(TenantNotConnectedError)
    })
  })
})
