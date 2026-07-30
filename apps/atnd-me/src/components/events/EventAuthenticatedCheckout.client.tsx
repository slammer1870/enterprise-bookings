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

    const releaseViaApi = (sync: boolean) => {
      if (paymentRedirectInProgressRef.current) return
      const url = '/api/bookings/release-hold'
      const body = JSON.stringify({ timeslotId })

      if (sync && typeof XMLHttpRequest !== 'undefined') {
        try {
          const xhr = new XMLHttpRequest()
          xhr.open('POST', url, false)
          xhr.setRequestHeader('Content-Type', 'application/json')
          xhr.withCredentials = true
          xhr.send(body)
        } catch {
          // fall through
        }
      }

      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        try {
          const blob = new Blob([body], { type: 'application/json' })
          if (navigator.sendBeacon(url, blob)) {
            // still also try keepalive fetch as cookies may be required
          }
        } catch {
          // fall through
        }
      }

      fetch(url, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        credentials: 'include',
      }).catch(() => {})
    }

    const handlePageExit = () => {
      checkoutSessionRef.current += 1
      releaseViaApi(true)
    }

    window.addEventListener('pagehide', handlePageExit)
    window.addEventListener('beforeunload', handlePageExit)

    return () => {
      checkoutSessionRef.current += 1
      window.removeEventListener('pagehide', handlePageExit)
      window.removeEventListener('beforeunload', handlePageExit)
      releaseViaApi(false)
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
        return () => {
          paymentRedirectInProgressRef.current = false
        }
      }}
    />
  )
}
