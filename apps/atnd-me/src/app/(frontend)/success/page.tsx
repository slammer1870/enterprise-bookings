import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { getPayload } from '@/lib/payload'
import { getSession } from '@/lib/auth/context/get-context-props'
import {
  getReceiptFromPaymentIntent,
  getReceiptFromBookingIds,
} from '@/lib/receipt/get-receipt-data'
import { SuccessReceipt } from './SuccessReceipt.client'
import Link from 'next/link'
import { Button } from '@repo/ui/components/ui/button'
import { getTenantSlugFromRequest } from '@/utilities/tenantRequest'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'

export const dynamic = 'force-dynamic'

type SuccessPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function getStripeAccountIdForTenantSite(): Promise<string | null> {
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
      stripeConnectAccountId: true,
      stripeConnectOnboardingStatus: true,
    } as any,
  })

  const tenant = tenants.docs[0] as
    | { stripeConnectAccountId?: string | null; stripeConnectOnboardingStatus?: string | null }
    | undefined

  const accountId = tenant?.stripeConnectAccountId?.trim()
  if (
    !accountId ||
    tenant?.stripeConnectOnboardingStatus !== 'active' ||
    isStripeTestAccount(accountId)
  ) {
    return null
  }

  return accountId
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

    return (
      <div className="container mx-auto max-w-screen-sm flex flex-col gap-6 py-12 min-h-screen pt-24">
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
  const stripeAccountId = await getStripeAccountIdForTenantSite()

  let receipt = null

  if (paymentIntent && redirectStatus === 'succeeded') {
    receipt = await getReceiptFromPaymentIntent(payload, paymentIntent, userId, {
      stripeAccountId,
    })
  }

  if (!receipt && bookingIds.length > 0) {
    receipt = await getReceiptFromBookingIds(payload, bookingIds, userId)
  }

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-6 py-12 min-h-screen pt-24">
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
