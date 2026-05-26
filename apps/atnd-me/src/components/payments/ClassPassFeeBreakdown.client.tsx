'use client'

import type { ClassPassFeeBreakdownComponentProps } from '@repo/payments-next'
import { useTRPC } from '@repo/trpc/client'
import { useQuery } from '@tanstack/react-query'

function formatCents(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

function ClassPassFeeBreakdownQuery({ classPassTypeId, classPriceCents }: ClassPassFeeBreakdownComponentProps) {
  const trpc = useTRPC()
  const procedure = trpc.payments.getClassPassFeeBreakdown!
  const { data, isLoading, error } = useQuery(
    procedure.queryOptions({ classPassTypeId, classPriceCents }),
  )
  if (isLoading || error || !data || data.bookingFeeCents <= 0) return null
  return (
    <p className="text-xs text-muted-foreground" data-testid="class-pass-platform-fee-note">
      Additional platform fee of {formatCents(data.bookingFeeCents)}
    </p>
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
