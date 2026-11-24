'use client'

import { useTRPC } from '@repo/trpc/client'
import { useQuery } from '@tanstack/react-query'

function formatCents(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

type Props = {
  priceId: string
  tenantId: number
}

function SubscriptionFeeBreakdownQuery({ priceId, tenantId }: Props) {
  const trpc = useTRPC()
  const procedure = trpc.payments.getSubscriptionFeeBreakdown!
  const { data, isLoading, error } = useQuery(
    procedure.queryOptions({
      priceId,
      quantity: 1,
      metadata: { tenantId: String(tenantId) },
    }),
  )
  if (isLoading || error || !data || data.bookingFeeCents <= 0) return null
  return (
    <p className="text-xs text-muted-foreground" data-testid="subscription-platform-fee-note">
      Additional platform fee of {formatCents(data.bookingFeeCents)}
    </p>
  )
}

/** Fetches subscription fee breakdown from tRPC. Returns null when unavailable. */
export function SubscriptionFeeBreakdown(props: Props) {
  const trpc = useTRPC()
  const procedure = trpc.payments.getSubscriptionFeeBreakdown
  if (!procedure?.queryOptions) return null
  return <SubscriptionFeeBreakdownQuery {...props} />
}
