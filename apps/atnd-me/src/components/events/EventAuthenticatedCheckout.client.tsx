'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import type { Timeslot } from '@repo/shared-types'
import { useTRPC } from '@repo/trpc/client'
import { useMutation } from '@tanstack/react-query'
import { PaymentMethodsConnect } from '@/components/payments/PaymentMethodsConnect.client'

/**
 * Authenticated checkout on the event page with checkout-hold reservation.
 */
export function EventAuthenticatedCheckout({
  timeslot,
  quantity,
  successUrl = '/success',
}: {
  timeslot: Timeslot
  quantity: number
  successUrl?: string
}) {
  const trpc = useTRPC()
  const paymentRedirectInProgressRef = useRef(false)
  const checkoutSessionRef = useRef(0)

  const { mutateAsync: upsertCheckoutHold } = useMutation(
    trpc.bookings.upsertCheckoutHold.mutationOptions(),
  )
  const { mutateAsync: releaseCheckoutHold } = useMutation(
    trpc.bookings.releaseCheckoutHold.mutationOptions(),
  )

  const onReserveCheckoutHold = useCallback(
    async (metadata: Record<string, string>) => {
      const session = checkoutSessionRef.current
      const qty = Math.max(
        1,
        parseInt(metadata.quantity ?? String(quantity), 10) || quantity,
      )
      const result = await upsertCheckoutHold({
        timeslotId: timeslot.id,
        quantity: qty,
      })
      if (session !== checkoutSessionRef.current) {
        await releaseCheckoutHold({ timeslotId: timeslot.id }).catch(() => {})
        return
      }
      return { holdId: String(result.holdId) }
    },
    [upsertCheckoutHold, releaseCheckoutHold, timeslot.id, quantity],
  )

  useEffect(() => {
    const timeslotId = timeslot.id
    return () => {
      checkoutSessionRef.current += 1
      if (paymentRedirectInProgressRef.current) return
      const body = JSON.stringify({ timeslotId })
      fetch('/api/bookings/release-hold', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        credentials: 'include',
      }).catch(() => {})
    }
  }, [timeslot.id])

  return (
    <PaymentMethodsConnect
      timeslot={timeslot}
      quantity={quantity}
      successUrl={successUrl}
      enabledMethods={['dropin']}
      onReserveCheckoutHold={onReserveCheckoutHold}
      onPaymentRedirectStart={() => {
        paymentRedirectInProgressRef.current = true
      }}
    />
  )
}
