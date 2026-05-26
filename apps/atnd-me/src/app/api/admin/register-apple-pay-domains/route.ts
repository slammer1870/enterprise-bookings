/**
 * One-shot admin endpoint: registers Apple Pay payment method domains with Stripe for every
 * active tenant on the platform — on both the platform account AND each tenant's connected
 * account (required because Elements is initialised with { stripeAccount }, so Apple Pay
 * checks the connected account's domain list).
 *
 * Super-admin only. Safe to call multiple times — already-registered domains are skipped.
 *
 * POST /api/admin/register-apple-pay-domains
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { getCurrentUser } from '@/lib/stripe-connect/api-helpers'
import { checkRole } from '@repo/shared-utils'
import { registerApplePayDomain } from '@/collections/Tenants/registerApplePayDomain'

type TenantRow = {
  id: number
  slug?: string | null
  domain?: string | null
  stripeConnectAccountId?: string | null
}

type DomainResult = {
  domain: string
  account: 'platform' | string
  tenantSlug: string
  status: 'registered' | 'already_registered' | 'error'
  error?: string
}

function getRootHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SERVER_URL
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
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

    const rootHostname = getRootHostname()

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
          domain: true,
          stripeConnectAccountId: true,
        } as Record<string, boolean>,
      })
      allTenants.push(...(result.docs as unknown as TenantRow[]))
      if (page >= result.totalPages) break
      page++
    }

    const results: DomainResult[] = []

    for (const tenant of allTenants) {
      const slug = typeof tenant.slug === 'string' ? tenant.slug.trim() : null
      const customDomain = typeof tenant.domain === 'string' ? tenant.domain.trim() : null
      const connectedAccountId =
        typeof tenant.stripeConnectAccountId === 'string' && tenant.stripeConnectAccountId.trim()
          ? tenant.stripeConnectAccountId.trim()
          : null
      const label = slug ?? String(tenant.id)

      const domains: string[] = []
      if (slug && rootHostname) domains.push(`${slug}.${rootHostname}`)
      if (customDomain) domains.push(customDomain)

      for (const domain of domains) {
        // Platform account
        results.push(await tryRegister(domain, label))
        // Connected account (required for Elements { stripeAccount } init)
        if (connectedAccountId) {
          results.push(await tryRegister(domain, label, connectedAccountId))
        }
      }
    }

    const summary = {
      total: results.length,
      registered: results.filter((r) => r.status === 'registered').length,
      alreadyRegistered: results.filter((r) => r.status === 'already_registered').length,
      errors: results.filter((r) => r.status === 'error').length,
    }

    return NextResponse.json({ summary, results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[api/admin/register-apple-pay-domains]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
