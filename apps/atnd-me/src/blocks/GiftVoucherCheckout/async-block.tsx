import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'
import { currentUser, getSession } from '@/lib/auth/context/get-context-props'
import { getCheckoutLegalForTenant } from '@/lib/checkout/getCheckoutLegalForTenant'
import {
  GiftVoucherCheckoutForm,
  type GiftVoucherCheckoutUser,
} from './GiftVoucherCheckoutForm.client'

type GiftVoucherCheckoutBlockProps = {
  heading?: string | null
  minAmount?: number | null
  maxAmount?: number | null
}

function toCheckoutUser(user: unknown): GiftVoucherCheckoutUser {
  if (!user || typeof user !== 'object') return null
  const u = user as { id?: unknown; email?: unknown; name?: unknown }
  const email = typeof u.email === 'string' ? u.email.trim() : ''
  if (!email) return null
  let id: number | null = null
  if (typeof u.id === 'number' && Number.isFinite(u.id)) id = u.id
  else if (typeof u.id === 'string' && /^\d+$/.test(u.id.trim())) id = parseInt(u.id.trim(), 10)
  if (id == null || id <= 0) return null
  return {
    id,
    email,
    name: typeof u.name === 'string' ? u.name : null,
  }
}

export async function GiftVoucherCheckoutAsync(props: GiftVoucherCheckoutBlockProps) {
  const tenantId = await resolveTenantIdFromServerContext()
  const session = await getSession()
  const user = toCheckoutUser(session?.user ?? (await currentUser()))
  const checkoutLegal = await getCheckoutLegalForTenant(tenantId)

  if (tenantId == null) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Gift vouchers are unavailable: no tenant context for this page.
      </p>
    )
  }

  return (
    <GiftVoucherCheckoutForm
      heading={props.heading}
      minAmount={props.minAmount}
      maxAmount={props.maxAmount}
      checkoutLegal={checkoutLegal}
      user={user}
    />
  )
}
