'use client'

import type { FeeBreakdownComponentProps } from '@repo/payments-next'
import { useTRPC } from '@repo/trpc/client'
import { useQuery } from '@tanstack/react-query'
import { BookingFeeBreakdown } from '@/components/booking/BookingFeeBreakdown'

/**
 * Inner component that runs the query. Only mounted when procedure exists (hooks rules).
 */
function DropInFeeBreakdownQuery({ lessonId, classPriceCents }: FeeBreakdownComponentProps) {
  const trpc = useTRPC()
  const procedure = trpc.payments.getDropInFeeBreakdown!
  const { data, isLoading, error } = useQuery(
    procedure.queryOptions({ lessonId, classPriceCents })
  )
  if (isLoading || error || !data) return null
  return (
    <BookingFeeBreakdown
      classPriceCents={data.classPriceCents}
      bookingFeeCents={data.bookingFeeCents}
    />
  )
}

/**
 * Fetches fee breakdown from tRPC and renders BookingFeeBreakdown.
 * Returns null when getDropInFeeBreakdown is not on the router (e.g. base package).
 */
export function DropInFeeBreakdown(props: FeeBreakdownComponentProps) {
  const trpc = useTRPC()
  const procedure = trpc.payments.getDropInFeeBreakdown
  if (!procedure?.queryOptions) return null
  return <DropInFeeBreakdownQuery {...props} />
}
