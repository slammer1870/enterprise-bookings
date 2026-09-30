import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { getPayload } from '@/lib/payload'
import { getSession } from '@/lib/auth/context/get-context-props'
import {
  getReceiptFromPaymentIntent,
  getReceiptFromBookingIds,
  retrieveSucceededPaymentIntent,
} from '@/lib/receipt/get-receipt-data'
import { SuccessReceipt } from './SuccessReceipt.client'
import Link from 'next/link'
import { Button } from '@repo/ui/components/ui/button'
import { getRequestHostname, getTenantSlugFromRequest } from '@/utilities/tenantRequest'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'
import { BookingCompletedAnalytics } from '@/components/analytics/BookingCompletedAnalytics'
import {
  paymentIntentConversion,
  receiptPaymentMethodForAnalytics,
  type VerifiedConversion,
} from '@/lib/analytics/conversion'
import { resolveUmamiAnalyticsConfig } from '@/lib/analytics/config'

export const dynamic = 'force-dynamic'

type SuccessPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

type TenantStripeContext = {
  tenantId: number
  stripeAccountId: string | null
}

async function getStripeContextForTenantSite(): Promise<TenantStripeContext | null> {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const tenantSlug = getTenantSlugFromRequest({
    cookies: cookieStore,
    headers: headerStore,
  })
  if (!tenantSlug) return null

  const payload = await getPayload()
  const tenants = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: tenantSlug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: {
      id: true,
      stripeConnectAccountId: true,
      stripeConnectOnboardingStatus: true,
    } as any,
  })

  const tenant = tenants.docs[0] as
    | {
        id: number
        stripeConnectAccountId?: string | null
        stripeConnectOnboardingStatus?: string | null
      }
    | undefined

  if (!tenant) return null

  const accountId = tenant?.stripeConnectAccountId?.trim()
  if (
    !accountId ||
    tenant?.stripeConnectOnboardingStatus !== 'active' ||
    isStripeTestAccount(accountId)
  ) {
    return { tenantId: tenant.id, stripeAccountId: null }
  }

  return { tenantId: tenant.id, stripeAccountId: accountId }
}

function parseBookingIds(param: string | null): number[] {
  if (!param) return []
  return param
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n))
}

function hasGuestCheckoutSuccessSignal(opts: {
  paymentIntent: string | null
  redirectStatus: string | null
  bookingIds: number[]
}): boolean {
  if (opts.paymentIntent && opts.redirectStatus === 'succeeded') return true
  // Free / zero-amount guest checkout redirects with bookingIds only.
  return opts.bookingIds.length > 0
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams
  const session = await getSession()
  const user = session?.user

  const paymentIntent = typeof params.payment_intent === 'string' ? params.payment_intent : null
  const redirectStatus = typeof params.redirect_status === 'string' ? params.redirect_status : null
  const bookingIdsParam = typeof params.bookingIds === 'string' ? params.bookingIds : null
  const bookingIds = parseBookingIds(bookingIdsParam)
  const headerStore = await headers()
  const hostname = getRequestHostname(headerStore)
  const analyticsEnabled = resolveUmamiAnalyticsConfig(hostname).enabled

  // Guest event checkout has no browser session — still show confirmation after Stripe
  // (or free booking) redirects back with success params. Do not force sign-in.
  if (!user?.id) {
    if (
      !hasGuestCheckoutSuccessSignal({
        paymentIntent,
        redirectStatus,
        bookingIds,
      })
    ) {
      redirect('/auth/sign-in?redirectTo=%2Fsuccess')
    }

    const stripeContext =
      analyticsEnabled && paymentIntent && redirectStatus === 'succeeded'
        ? await getStripeContextForTenantSite().catch(() => null)
        : null
    const succeededPaymentIntent =
      paymentIntent && stripeContext
        ? await retrieveSucceededPaymentIntent(paymentIntent, stripeContext.stripeAccountId).catch(
            () => null,
          )
        : null
    const conversion =
      stripeContext && succeededPaymentIntent
        ? paymentIntentConversion({
            paymentIntent: succeededPaymentIntent,
            tenantId: stripeContext.tenantId,
            requireGuestCheckout: true,
          })
        : null

    return (
      <div className="container mx-auto max-w-screen-sm flex flex-col gap-6 py-12 min-h-screen pt-24">
        {conversion && paymentIntent && (
          <BookingCompletedAnalytics
            {...conversion}
            dedupeKey={`payment-intent:${paymentIntent}`}
          />
        )}
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">Thank you!</h1>
          <p className="text-muted-foreground">Your booking has been confirmed.</p>
        </div>

        <div className="mt-4">
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    )
  }

  const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10)
  if (Number.isNaN(userId)) redirect('/auth/sign-in?redirectTo=%2Fsuccess')
  const payload = await getPayload()
  const stripeContext = await getStripeContextForTenantSite()
  const succeededPaymentIntent =
    analyticsEnabled && paymentIntent && redirectStatus === 'succeeded' && stripeContext
      ? await retrieveSucceededPaymentIntent(paymentIntent, stripeContext.stripeAccountId).catch(
          () => null,
        )
      : null
  const paymentIntentReceiptConversion =
    stripeContext && succeededPaymentIntent
      ? paymentIntentConversion({
          paymentIntent: succeededPaymentIntent,
          tenantId: stripeContext.tenantId,
          viewerUserId: userId,
        })
      : null
  let receipt = null

  if (paymentIntent && redirectStatus === 'succeeded') {
    receipt = await getReceiptFromPaymentIntent(payload, paymentIntent, userId, {
      stripeAccountId: stripeContext?.stripeAccountId ?? null,
    })
  }

  if (!receipt && bookingIds.length > 0) {
    receipt = await getReceiptFromBookingIds(payload, bookingIds, userId)
  }

  const fallbackReceiptConversion: VerifiedConversion | null =
    analyticsEnabled && receipt && !paymentIntentReceiptConversion
      ? {
          eventName: 'Booking Completed',
          bookingFlow: 'checkout',
          quantity: receipt.bookingCount,
          isTrial: false,
          paymentMethod: receiptPaymentMethodForAnalytics(receipt),
          revenue:
            receipt.amountPaidCents != null && receipt.amountPaidCents > 0
              ? {
                  amount: Number((receipt.amountPaidCents / 100).toFixed(2)),
                  currency: receipt.currency.toUpperCase(),
                }
              : undefined,
        }
      : null
  const conversion = paymentIntentReceiptConversion ?? fallbackReceiptConversion
  const conversionDedupeKey = paymentIntent
    ? `payment-intent:${paymentIntent}`
    : bookingIds.length > 0
      ? `bookings:${[...new Set(bookingIds)].sort((a, b) => a - b).join(',')}`
      : null

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-6 py-12 min-h-screen pt-24">
      {conversion && conversionDedupeKey && (
        <BookingCompletedAnalytics {...conversion} dedupeKey={conversionDedupeKey} />
      )}
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Thank you!</h1>
        <p className="text-muted-foreground">
          {receipt
            ? 'Your booking has been confirmed. Here are the details:'
            : 'Your booking has been confirmed.'}
        </p>
      </div>

      {receipt && <SuccessReceipt receipt={receipt} />}

      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        {receipt?.timeslot && (
          <Button variant="outline" asChild>
            <Link href={`/bookings/${receipt.timeslot.id}`}>View booking</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
