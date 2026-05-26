'use client'

import type { ClassPassFeeBreakdownComponentProps } from '@repo/payments-next'
import { useTRPC } from '@repo/trpc/client'
import { useQuery } from '@tanstack/react-query'
import { BookingFeeBreakdown } from '@/components/booking/BookingFeeBreakdown'

function ClassPassFeeBreakdownQuery({ classPassTypeId, classPriceCents }: ClassPassFeeBreakdownComponentProps) {
  const trpc = useTRPC()
  const procedure = trpc.payments.getClassPassFeeBreakdown!
  const { data, isLoading, error } = useQuery(
    procedure.queryOptions({ classPassTypeId, classPriceCents }),
  )
  if (isLoading || error || !data) return null
  return (
    <BookingFeeBreakdown
      classPriceCents={data.classPriceCents}
      bookingFeeCents={data.bookingFeeCents}
      feeLabel="Platform fee"
    />
  )
}

/**
 * Fetches class pass fee breakdown from tRPC and renders BookingFeeBreakdown.
 * Returns null when getClassPassFeeBreakdown is not on the router.
 */
export function ClassPassFeeBreakdown(props: ClassPassFeeBreakdownComponentProps) {
  const trpc = useTRPC()
  const procedure = trpc.payments.getClassPassFeeBreakdown
  if (!procedure?.queryOptions) return null
  return <ClassPassFeeBreakdownQuery {...props} />
}
