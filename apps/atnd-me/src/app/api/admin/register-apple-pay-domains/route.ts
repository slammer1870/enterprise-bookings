/**
 * Super-admin endpoint: registers Apple Pay payment method domains with Stripe for every
 * tenant — serving hosts on the platform account, and serving hosts plus the platform
 * subdomain on each connected account (required because Elements is initialised with
 * { stripeAccount }).
 *
 * Safe to call multiple times — already-registered and Apple Pay-active domains are skipped.
 *
 * POST /api/admin/register-apple-pay-domains
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { getCurrentUser } from '@/lib/stripe-connect/api-helpers'
import { checkRole } from '@repo/shared-utils'
import {
  applePayDomainsForConnectedAccount,
  applePayDomainsForDeclaration,
  registerApplePayDomain,
} from '@/collections/Tenants/registerApplePayDomain'
import type { TenantPublicHostDocSlice } from '@/utilities/tenantPublicHostDeclaration'

type TenantRow = TenantPublicHostDocSlice & {
  id: number
  stripeConnectAccountId?: string | null
}

type DomainResult = {
  domain: string
  account: 'platform' | string
  tenantSlug: string
  status: 'registered' | 'error'
  error?: string
}

async function tryRegister(
  domain: string,
  tenantSlug: string,
  stripeAccountId?: string,
): Promise<DomainResult> {
  const account = stripeAccountId ?? 'platform'
  try {
    await registerApplePayDomain(domain, stripeAccountId)
    return { domain, account, tenantSlug, status: 'registered' }
  } catch (err: unknown) {
    return {
      domain,
      account,
      tenantSlug,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    const user = await getCurrentUser(payload, request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!checkRole(['super-admin'], user as Parameters<typeof checkRole>[1])) {
      return NextResponse.json({ error: 'Forbidden — super-admin only' }, { status: 403 })
    }

    let page = 1
    const allTenants: TenantRow[] = []
    while (true) {
      const result = await payload.find({
        collection: 'tenants',
        page,
        limit: 100,
        depth: 0,
        overrideAccess: true,
        select: {
          id: true,
          slug: true,
          hostnames: true,
          direction: true,
          stripeConnectAccountId: true,
        } as Record<string, boolean>,
      })
      allTenants.push(...(result.docs as unknown as TenantRow[]))
      if (page >= result.totalPages) break
      page++
    }

    const results: DomainResult[] = []

    for (const tenant of allTenants) {
      const slug = typeof tenant.slug === 'string' ? tenant.slug.trim() : String(tenant.id)
      const connectedAccountId =
        typeof tenant.stripeConnectAccountId === 'string' && tenant.stripeConnectAccountId.trim()
          ? tenant.stripeConnectAccountId.trim()
          : null

      const platformDomains = applePayDomainsForDeclaration(tenant)
      const connectedDomains = applePayDomainsForConnectedAccount(tenant)

      for (const domain of platformDomains) {
        results.push(await tryRegister(domain, slug))
      }
      if (connectedAccountId) {
        for (const domain of connectedDomains) {
          results.push(await tryRegister(domain, slug, connectedAccountId))
        }
      }
    }

    const summary = {
      total: results.length,
      registered: results.filter((r) => r.status === 'registered').length,
      errors: results.filter((r) => r.status === 'error').length,
    }

    return NextResponse.json({ summary, results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[api/admin/register-apple-pay-domains]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
