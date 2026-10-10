'use client'

import { useEffect } from 'react'
import { useAnalyticsTracker } from '@repo/analytics'
import type { VerifiedConversion } from '@/lib/analytics/conversion'

type BookingCompletedAnalyticsProps = VerifiedConversion & {
  dedupeKey: string
}

export function BookingCompletedAnalytics({
  eventName,
  bookingFlow,
  quantity,
  isTrial = false,
  paymentMethod,
  revenue,
  dedupeKey,
}: BookingCompletedAnalyticsProps) {
  const { trackEvent } = useAnalyticsTracker()

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('payment_intent_client_secret')
    url.searchParams.delete('analyticsTracked')

    const storageKey = `analytics:conversion:${dedupeKey}`
    const currentState =
      window.history.state && typeof window.history.state === 'object'
        ? window.history.state
        : {}
    const historyKeys = Array.isArray(currentState.__analyticsConversionKeys)
      ? currentState.__analyticsConversionKeys.filter(
          (key: unknown): key is string => typeof key === 'string',
        )
      : []

    let alreadyTracked = historyKeys.includes(dedupeKey)
    try {
      alreadyTracked ||= window.sessionStorage.getItem(storageKey) === '1'
    } catch {
      // History state remains available when session storage is restricted.
    }

    if (alreadyTracked) {
      window.history.replaceState(currentState, '', url)
      return
    }

    trackEvent(eventName, {
      booking_flow: bookingFlow,
      quantity,
      is_trial: isTrial,
      payment_method: paymentMethod,
      ...(revenue ? { revenue } : {}),
    })
    try {
      window.sessionStorage.setItem(storageKey, '1')
    } catch {
      // History state below still deduplicates reloads for this entry.
    }
    window.history.replaceState(
      {
        ...currentState,
        __analyticsConversionKeys: [...new Set([...historyKeys, dedupeKey])],
      },
      '',
      url,
    )
  }, [bookingFlow, dedupeKey, eventName, isTrial, paymentMethod, quantity, revenue, trackEvent])

  return null
}
