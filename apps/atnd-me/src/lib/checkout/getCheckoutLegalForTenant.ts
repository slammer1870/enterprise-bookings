import type { CheckoutLegalConfig } from '@repo/payments-next'
import { getPayload } from '@/lib/payload'

/**
 * Load tenant checkout legal document links (pages) for checkout UIs
 * (booking drop-in, gift voucher purchase, etc.).
 */
export async function getCheckoutLegalForTenant(
  tenantId: number | null | undefined,
): Promise<CheckoutLegalConfig | null> {
  if (tenantId == null || !Number.isFinite(tenantId) || tenantId <= 0) return null

  try {
    const payload = await getPayload()
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 1,
      overrideAccess: true,
    })

    const docs = (tenant as { checkoutLegalDocuments?: Array<{ page: unknown }> | null })
      ?.checkoutLegalDocuments ?? []
    const links = docs
      .filter((d) => d.page && typeof d.page === 'object')
      .map((d) => {
        const page = d.page as { title?: string; slug?: string }
        return { label: page.title ?? '', href: `/${page.slug ?? ''}` }
      })
      .filter((l) => l.label && l.href && l.href !== '/')

    return links.length > 0 ? { links } : null
  } catch (err) {
    console.error('[getCheckoutLegalForTenant]', err)
    return null
  }
}
