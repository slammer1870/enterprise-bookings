'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@repo/trpc/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog'

import { Button } from '@/components/ui/button'

import {
  buildUpgradeConfirmCopy,
  type UpgradeConfirmPlanSnapshot,
} from './subscriptionUpgradeConfirmSummary'

type Props = {
  open: boolean
  currentPlan: UpgradeConfirmPlanSnapshot | null
  newPlan: UpgradeConfirmPlanSnapshot | null
  tenantId: number
  isConfirming: boolean
  onCancel: () => void
  onConfirm: () => void
}

function UpgradeConfirmBody({
  currentPlan,
  newPlan,
  tenantId,
}: {
  currentPlan: UpgradeConfirmPlanSnapshot | null
  newPlan: UpgradeConfirmPlanSnapshot
  tenantId: number
}) {
  const trpc = useTRPC()
  const procedure = trpc.payments.getSubscriptionFeeBreakdown
  const priceId = newPlan.priceId ?? ''
  const canQuery = Boolean(procedure?.queryOptions && priceId)
  const feeQueryOptions = canQuery
    ? procedure!.queryOptions({
        priceId,
        quantity: 1,
        metadata: { tenantId: String(tenantId) },
      })
    : {
        queryKey: ['subscription-upgrade-confirm-fee-disabled'] as const,
        queryFn: async () => null,
      }
  const { data, isLoading } = useQuery({
    ...feeQueryOptions,
    enabled: canQuery,
  })

  const fee =
    data && data.bookingFeeCents > 0
      ? {
          bookingFeeCents: data.bookingFeeCents,
          totalCents: data.totalCents,
          currency: data.currency,
        }
      : null

  const copy = buildUpgradeConfirmCopy({
    currentPlan,
    newPlan,
    fee: isLoading ? null : fee,
  })

  return (
    <>
      <dl className="space-y-3 text-sm" data-testid="subscription-upgrade-confirm-details">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Current plan</dt>
          <dd className="text-right font-medium text-foreground">{copy.fromLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">New plan</dt>
          <dd className="text-right font-medium text-foreground">{copy.toLabel}</dd>
        </div>
        {copy.feeLabel ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Platform fee</dt>
            <dd className="text-right tabular-nums text-foreground">
              {copy.feeLabel.replace(/^Platform fee /, '')}
            </dd>
          </div>
        ) : null}
        {copy.totalLabel ? (
          <div className="flex justify-between gap-4 border-t border-border pt-3">
            <dt className="font-medium text-foreground">New recurring total</dt>
            <dd className="text-right font-semibold tabular-nums text-foreground">
              {copy.totalLabel}
            </dd>
          </div>
        ) : null}
      </dl>
      <DialogDescription className="pt-1 text-left">{copy.notice}</DialogDescription>
    </>
  )
}

export function SubscriptionUpgradeConfirmDialog({
  open,
  currentPlan,
  newPlan,
  tenantId,
  isConfirming,
  onCancel,
  onConfirm,
}: Props) {
  if (!newPlan) return null

  const title = buildUpgradeConfirmCopy({
    currentPlan,
    newPlan,
    fee: null,
  }).title

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isConfirming) onCancel()
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        data-testid="subscription-upgrade-confirm-dialog"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <UpgradeConfirmBody
          currentPlan={currentPlan}
          newPlan={newPlan}
          tenantId={tenantId}
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={isConfirming}
            onClick={onCancel}
            data-testid="subscription-upgrade-confirm-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isConfirming}
            onClick={onConfirm}
            data-testid="subscription-upgrade-confirm-continue"
          >
            {isConfirming ? 'Updating…' : 'Confirm upgrade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
