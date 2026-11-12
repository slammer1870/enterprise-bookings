/**
 * A save or delete the admin can put right must say why it was refused.
 * Payload replaces the message of any error that is not a client error with
 * "Something went wrong.", so each refusal here has to reach the toast as a 400.
 */
import { describe, expect, it, vi } from 'vitest'

import { Locations } from '@/collections/Locations'
import { Pages } from '@/collections/Pages'
import { Posts } from '@/collections/Posts'
import { Scheduler } from '@/collections/Scheduler'
import { Tenants } from '@/collections/Tenants'
import { tenantScopedSlugField } from '@/fields/tenant-scoped-slug-field'
import { classPassTypeBeforeDeleteArchive } from '@/hooks/classPassTypesStripeSync'
import { planBeforeDeleteArchive } from '@/hooks/plansStripeSync'
import { requireStripeConnectForPayments } from '@/hooks/requireStripeConnectForPayments'
import { validateTimeslotBranchMatchesTenant } from '@/hooks/validateTimeslotBranchMatchesTenant'

import { refusalToast, runHooks } from '../helpers/admin-toast'

vi.mock('@/lib/stripe-connect/products', () => ({
  archiveTenantProduct: vi.fn().mockResolvedValue(undefined),
  createTenantPrice: vi.fn(),
  createTenantProduct: vi.fn(),
  updateTenantProduct: vi.fn(),
}))

const connectedTenant = {
  id: 1,
  stripeConnectAccountId: 'acct_1',
  stripeConnectOnboardingStatus: 'active',
}

/** A product already synced to Stripe, in a tenant with an active Connect account. */
function payloadWithSyncedProduct(collection: string) {
  return {
    findByID: async (args: { collection: string }) =>
      args.collection === collection
        ? { id: 4, tenant: connectedTenant.id, stripeProductId: 'prod_1' }
        : connectedTenant,
    update: async () => ({}),
  }
}

const slugHooks = (tenantScopedSlugField({ collection: 'posts' }) as { hooks?: { beforeValidate?: unknown } })
  .hooks?.beforeValidate

const refusals: { refused: string; run: () => unknown; toast: RegExp }[] = [
  {
    refused: 'an event type given a drop-in price before the tenant connects Stripe',
    run: () =>
      requireStripeConnectForPayments({
        data: { tenant: 1, paymentMethods: { allowedDropIn: 4 } },
        operation: 'create',
        originalDoc: undefined,
        req: {
          payload: { findByID: async () => ({ stripeConnectOnboardingStatus: 'not_connected' }) },
        },
      } as never),
    toast: /Connect Stripe to enable payments/,
  },
  {
    refused: 'a timeslot whose branch belongs to another tenant',
    run: () =>
      validateTimeslotBranchMatchesTenant({
        data: { tenant: 1, branch: 2 },
        operation: 'create',
        originalDoc: undefined,
        req: { payload: { findByID: async () => ({ id: 2, tenant: 9 }) } },
      } as never),
    toast: /Branch must belong to the same tenant/,
  },
  {
    refused: 'a scheduler with no branch when the tenant has several active sites',
    run: () =>
      runHooks(Scheduler.hooks?.beforeValidate, {
        data: { tenant: 1 },
        operation: 'update',
        req: { context: {}, user: { id: 5 }, payload: { find: async () => ({ totalDocs: 2 }) } },
      }),
    toast: /A branch must be selected/,
  },
  {
    refused: 'a location whose slug another location in the tenant already uses',
    run: () =>
      runHooks(Locations.hooks?.beforeValidate, {
        data: { tenant: 1, slug: 'main-studio' },
        operation: 'create',
        req: { context: {}, payload: { find: async () => ({ docs: [{ id: 3 }] }) } },
      }),
    toast: /location with the slug "main-studio" already exists/,
  },
  {
    refused: 'a post whose slug another post on the site already uses',
    run: () =>
      runHooks(
        slugHooks,
        {
          data: { tenant: 1 },
          operation: 'create',
          req: { context: {}, payload: { find: async () => ({ docs: [{ id: 3 }] }) } },
          value: 'opening-hours',
        },
        'value',
      ),
    toast: /post with the slug "opening-hours" already exists/,
  },
  {
    refused: 'a page that uses a block the tenant has not been given',
    run: () =>
      runHooks(Pages.hooks?.beforeChange, {
        data: { tenant: 1, layout: [{ blockType: 'blockNobodyHas' }] },
        operation: 'update',
        req: {
          data: { publishedAt: '2026-01-01T00:00:00.000Z' },
          payload: { findByID: async () => ({ id: 1, allowedBlocks: [] }) },
        },
      }),
    toast: /not enabled for this tenant: blockNobodyHas/,
  },
  {
    refused: 'a post created without a tenant by a tenant admin',
    run: () =>
      runHooks(Posts.hooks?.beforeValidate, {
        data: { tenant: null, title: 'Opening hours' },
        operation: 'create',
        req: { context: {}, user: { id: 5, role: ['admin'] }, payload: {} },
      }),
    toast: /Assign a tenant to create a post/,
  },
  {
    refused: 'a tenant whose hostname list is not a list',
    run: () =>
      runHooks(Tenants.hooks?.beforeValidate, {
        data: { hostnames: 'www.example.com' },
        operation: 'update',
        originalDoc: { id: 1 },
        req: { context: {}, payload: {} },
      }),
    toast: /Hostname list must be a list/,
  },
  {
    refused: 'deleting a plan that is archived in Stripe instead',
    run: () =>
      planBeforeDeleteArchive({
        id: 4,
        req: { payload: payloadWithSyncedProduct('plans') },
      } as never),
    toast: /Plan was archived instead of deleted/,
  },
  {
    refused: 'deleting a class pass type that is archived in Stripe instead',
    run: () =>
      classPassTypeBeforeDeleteArchive({
        id: 4,
        req: { payload: payloadWithSyncedProduct('class-pass-types') },
      } as never),
    toast: /Class pass type was archived instead of deleted/,
  },
]

describe('refusals the admin can act on', () => {
  it.each(refusals)('explains $refused', async ({ run, toast }) => {
    expect(await refusalToast(run)).toEqual({
      status: 400,
      messages: [expect.stringMatching(toast)],
    })
  })
})
