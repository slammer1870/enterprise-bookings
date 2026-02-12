import { redirect } from 'next/navigation'
import { getPayload } from '@/lib/payload'
import { getSession } from '@/lib/auth/context/get-context-props'
import {
  getReceiptFromPaymentIntent,
  getReceiptFromBookingIds,
} from '@/lib/receipt/get-receipt-data'
import { SuccessReceipt } from './SuccessReceipt.client'
import Link from 'next/link'
import { Button } from '@repo/ui/components/ui/button'

export const dynamic = 'force-dynamic'

type SuccessPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams
  const session = await getSession()
  const user = session?.user

  if (!user?.id) {
    redirect('/auth/sign-in?callbackUrl=/success')
  }

  const userId = typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10)
  if (Number.isNaN(userId)) redirect('/auth/sign-in?callbackUrl=/success')
  const payload = await getPayload()

  const paymentIntent = typeof params.payment_intent === 'string' ? params.payment_intent : null
  const redirectStatus = typeof params.redirect_status === 'string' ? params.redirect_status : null
  const bookingIdsParam = typeof params.bookingIds === 'string' ? params.bookingIds : null

  let receipt = null

  if (paymentIntent && redirectStatus === 'succeeded') {
    receipt = await getReceiptFromPaymentIntent(payload, paymentIntent, userId)
  } else if (bookingIdsParam) {
    const ids = bookingIdsParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n))
    if (ids.length > 0) {
      receipt = await getReceiptFromBookingIds(payload, ids, userId)
    }
  }

  return (
    <div className="container mx-auto max-w-screen-sm flex flex-col gap-6 px-4 py-12 min-h-screen pt-24">
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
        {receipt?.lesson && (
          <Button variant="outline" asChild>
            <Link href={`/bookings/${receipt.lesson.id}`}>View booking</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
