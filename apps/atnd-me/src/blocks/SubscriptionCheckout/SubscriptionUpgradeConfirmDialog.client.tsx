'use client'

import { useCallback, useEffect, useState } from 'react'
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
  type UpgradeConfirmFeeSnapshot,
  type UpgradeConfirmPlanSnapshot,
  type UpgradeConfirmPreviewSnapshot,
} from './subscriptionUpgradeConfirmSummary'

type Props = {
  open: boolean
  currentPlan: UpgradeConfirmPlanSnapshot | null
  newPlan: UpgradeConfirmPlanSnapshot | null
  tenantId: number
  isConfirming: boolean
  onCancel: () => void
  onConfirm: (_preview: UpgradeConfirmPreviewSnapshot) => void
}

function UpgradeConfirmDetails({
  currentPlan,
  newPlan,
  fee,
  preview,
  previewLoading,
}: {
  currentPlan: UpgradeConfirmPlanSnapshot | null
  newPlan: UpgradeConfirmPlanSnapshot
  fee: UpgradeConfirmFeeSnapshot
  preview: UpgradeConfirmPreviewSnapshot
  previewLoading: boolean
}) {
  const copy = buildUpgradeConfirmCopy({ currentPlan, newPlan, fee, preview })

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
        {previewLoading ? (
          <div
            className="flex justify-between gap-4"
            data-testid="subscription-upgrade-preview-loading"
          >
            <dt className="text-muted-foreground">Prorated charge</dt>
            <dd className="text-right text-muted-foreground">Calculating…</dd>
          </div>
        ) : copy.chargeAmountLabel && copy.chargeWhenLabel ? (
          <>
            <div
              className="flex justify-between gap-4"
              data-testid="subscription-upgrade-due-now"
            >
              <dt className="font-medium text-foreground">
                {preview?.chargeTiming === 'next_invoice' ||
                preview?.chargeTiming === 'credit_next_invoice'
                  ? 'Prorated amount'
                  : preview?.chargeTiming === 'none'
                    ? 'Prorated charge'
                    : 'Due now'}
              </dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">
                {copy.chargeAmountLabel}
              </dd>
            </div>
            <div
              className="flex justify-between gap-4"
              data-testid="subscription-upgrade-due-when"
            >
              <dt className="text-muted-foreground">When</dt>
              <dd className="text-right text-foreground">{copy.chargeWhenLabel}</dd>
            </div>
          </>
        ) : null}
        {copy.nextRenewalLabel ? (
          <div
            className="flex justify-between gap-4"
            data-testid="subscription-upgrade-next-renewal"
          >
            <dt className="text-muted-foreground">After that</dt>
            <dd className="text-right text-foreground">{copy.nextRenewalLabel}</dd>
          </div>
        ) : null}
      </dl>
      <DialogDescription className="pt-1 text-left">{copy.notice}</DialogDescription>
    </>
  )
}

function UpgradeFeeQuery({
  priceId,
  tenantId,
  onFee,
}: {
  priceId: string
  tenantId: number
  onFee: (_fee: UpgradeConfirmFeeSnapshot) => void
}) {
  const trpc = useTRPC()
  const procedure = trpc.payments.getSubscriptionFeeBreakdown!
  const { data, isLoading } = useQuery(
    procedure.queryOptions({
      priceId,
      quantity: 1,
      metadata: { tenantId: String(tenantId) },
    }),
  )

  useEffect(() => {
    if (isLoading) return
    if (data && data.bookingFeeCents > 0) {
      onFee({
        bookingFeeCents: data.bookingFeeCents,
        totalCents: data.totalCents,
        currency: data.currency,
      })
      return
    }
    onFee(null)
  }, [data, isLoading, onFee])

  return null
}

function UpgradePreviewQuery({
  planId,
  onPreview,
  onLoading,
}: {
  planId: number
  onPreview: (_preview: UpgradeConfirmPreviewSnapshot) => void
  onLoading: (_loading: boolean) => void
}) {
  const trpc = useTRPC()
  const procedure = trpc.payments.previewSubscriptionUpgrade!
  const { data, isLoading } = useQuery(procedure.queryOptions({ planId }))

  useEffect(() => {
    onLoading(isLoading)
  }, [isLoading, onLoading])

  useEffect(() => {
    if (isLoading) return
    if (data && typeof data.chargeAmountCents === 'number') {
      onPreview({
        chargeAmountCents: data.chargeAmountCents,
        chargeTiming: data.chargeTiming,
        currency: data.currency,
        nextPeriodEndUnix: data.nextPeriodEndUnix ?? null,
        recurringTotalCents: data.recurringTotalCents ?? null,
        prorationDate: data.prorationDate,
      })
      return
    }
    onPreview(null)
  }, [data, isLoading, onPreview])

  return null
}

function UpgradeConfirmBody({
  currentPlan,
  newPlan,
  tenantId,
  onPreviewChange,
}: {
  currentPlan: UpgradeConfirmPlanSnapshot | null
  newPlan: UpgradeConfirmPlanSnapshot
  tenantId: number
  onPreviewChange: (_preview: UpgradeConfirmPreviewSnapshot) => void
}) {
  const trpc = useTRPC()
  const feeProcedure = trpc.payments.getSubscriptionFeeBreakdown
  const previewProcedure = trpc.payments.previewSubscriptionUpgrade
  const [fee, setFee] = useState<UpgradeConfirmFeeSnapshot>(null)
  const [preview, setPreview] = useState<UpgradeConfirmPreviewSnapshot>(null)
  const [previewLoading, setPreviewLoading] = useState(Boolean(previewProcedure))

  const onFee = useCallback((next: UpgradeConfirmFeeSnapshot) => {
    setFee(next)
  }, [])
  const onPreview = useCallback(
    (next: UpgradeConfirmPreviewSnapshot) => {
      setPreview(next)
      onPreviewChange(next)
    },
    [onPreviewChange],
  )
  const onLoading = useCallback((loading: boolean) => {
    setPreviewLoading(loading)
  }, [])

  return (
    <>
      {feeProcedure && newPlan.priceId ? (
        <UpgradeFeeQuery priceId={newPlan.priceId} tenantId={tenantId} onFee={onFee} />
      ) : null}
      {previewProcedure ? (
        <UpgradePreviewQuery
          planId={newPlan.planId}
          onPreview={onPreview}
          onLoading={onLoading}
        />
      ) : null}
      <UpgradeConfirmDetails
        currentPlan={currentPlan}
        newPlan={newPlan}
        fee={fee}
        preview={preview}
        previewLoading={previewLoading}
      />
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
  const [preview, setPreview] = useState<UpgradeConfirmPreviewSnapshot>(null)
  const onPreviewChange = useCallback((next: UpgradeConfirmPreviewSnapshot) => {
    setPreview(next)
  }, [])

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

        {open ? (
          <UpgradeConfirmBody
            currentPlan={currentPlan}
            newPlan={newPlan}
            tenantId={tenantId}
            onPreviewChange={onPreviewChange}
          />
        ) : null}

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
            onClick={() => onConfirm(preview)}
            data-testid="subscription-upgrade-confirm-continue"
          >
            {isConfirming ? 'Updating…' : 'Confirm upgrade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
