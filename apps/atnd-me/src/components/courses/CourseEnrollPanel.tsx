'use client'

import React, { useEffect, useState } from 'react'
import { CheckoutForm, CheckoutLegalAcceptance, type CheckoutLegalConfig } from '@repo/payments-next'
import { BookingFeeBreakdown } from '@/components/booking/BookingFeeBreakdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isCompleteGuestEmail } from '@/lib/courses/resolve-course-for-purchase'
import { coursePlacesLabel } from '@/components/courses/coursePlacesLabel'

type CourseEnrollPanelProps = {
  courseId: number
  price: number
  remainingEnrollments: number | null
  isAuthenticated: boolean
  isOpen: boolean
  accessWindowLabel: string | null
  checkoutLegal?: CheckoutLegalConfig | null
  successUrl?: string
}

export function CourseEnrollPanel({
  courseId,
  price,
  remainingEnrollments,
  isAuthenticated,
  isOpen,
  accessWindowLabel,
  checkoutLegal,
  successUrl = '/success',
}: CourseEnrollPanelProps) {
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [settledGuest, setSettledGuest] = useState<{ name: string; email: string } | null>(null)
  const [guestFormError, setGuestFormError] = useState<string | null>(null)
  const [feeBreakdown, setFeeBreakdown] = useState<{
    classPriceCents: number
    bookingFeeCents: number
    totalCents: number
  } | null>(null)

  const soldOut = remainingEnrollments != null && remainingEnrollments <= 0
  const places = coursePlacesLabel(remainingEnrollments)
  const emphasizePlaces =
    remainingEnrollments != null && remainingEnrollments > 0 && remainingEnrollments <= 6
  const classPriceCents = Math.round(price * 100)

  useEffect(() => {
    if (!isOpen || soldOut || price <= 0) {
      setFeeBreakdown(null)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/courses/fee-breakdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ courseId, classPriceCents }),
        })
        if (!res.ok) return
        const data = (await res.json()) as {
          classPriceCents: number
          bookingFeeCents: number
          totalCents: number
        }
        setFeeBreakdown(data)
      } catch {
        // ignore abort / network
      }
    }, 200)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [classPriceCents, courseId, isOpen, price, soldOut])

  if (!isOpen) {
    return (
      <aside
        className="rounded-xl border border-border bg-card p-5 shadow-sm"
        data-testid="course-enroll-panel"
      >
        <h2 className="text-lg font-semibold text-foreground">Enroll</h2>
        <p className="mt-2 text-sm text-muted-foreground">Enrollment is closed for this course.</p>
      </aside>
    )
  }

  if (soldOut) {
    return (
      <aside
        className="rounded-xl border border-border bg-card p-5 shadow-sm"
        data-testid="course-enroll-panel"
      >
        <h2 className="text-lg font-semibold text-foreground">Enroll</h2>
        <p className="mt-2 text-sm font-medium text-destructive">Sold out</p>
      </aside>
    )
  }

  if (price <= 0) {
    return (
      <aside
        className="rounded-xl border border-border bg-card p-5 shadow-sm"
        data-testid="course-enroll-panel"
      >
        <h2 className="text-lg font-semibold text-foreground">Enroll</h2>
        <p className="mt-2 text-sm text-muted-foreground">Price is not configured for this course.</p>
      </aside>
    )
  }

  const handleContinueToPayment = (e: React.FormEvent) => {
    e.preventDefault()
    const name = guestName.trim()
    const email = guestEmail.trim().toLowerCase()
    if (name.length < 2) {
      setGuestFormError('Enter your name to continue.')
      return
    }
    if (!isCompleteGuestEmail(email)) {
      setGuestFormError('Enter a complete email address (for example you@example.com).')
      return
    }
    setGuestFormError(null)
    setSettledGuest({ name, email })
  }

  const totalDisplayCents = feeBreakdown?.totalCents ?? classPriceCents
  const priceComponent = (
    <div className="my-2 text-lg font-medium">
      Total: €{(totalDisplayCents / 100).toFixed(2)}
    </div>
  )

  return (
    <aside
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
      data-testid="course-enroll-panel"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Enroll</h2>
        <p className="text-xl font-semibold tabular-nums text-foreground">€{price.toFixed(2)}</p>
      </div>

      {accessWindowLabel ? (
        <p className="mt-2 text-sm text-muted-foreground" data-testid="course-access-window">
          {accessWindowLabel}
        </p>
      ) : null}

      {places ? (
        <p
          className={`mt-2 text-sm ${
            emphasizePlaces
              ? 'font-medium text-amber-700 dark:text-amber-400'
              : 'text-muted-foreground'
          }`}
          data-testid="course-places-remaining"
        >
          {places}
        </p>
      ) : null}

      {feeBreakdown ? (
        <div className="mt-4">
          <BookingFeeBreakdown
            classPriceCents={feeBreakdown.classPriceCents}
            bookingFeeCents={feeBreakdown.bookingFeeCents}
          />
        </div>
      ) : null}

      {isAuthenticated ? (
        <div className="mt-4">
          <CheckoutForm
            price={price}
            priceComponent={priceComponent}
            createPaymentIntentUrl="/api/courses/purchase"
            returnUrl={successUrl}
            metadata={{ courseId: String(courseId) }}
          />
          {checkoutLegal ? (
            <CheckoutLegalAcceptance
              config={checkoutLegal}
              agreementPrefix="By enrolling in this course, you agree to our"
            />
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <form className="space-y-3" onSubmit={handleContinueToPayment}>
            <div className="space-y-1.5">
              <Label htmlFor="course-guest-name">Name</Label>
              <Input
                id="course-guest-name"
                value={guestName}
                onChange={(e) => {
                  setGuestName(e.target.value)
                  if (settledGuest) setSettledGuest(null)
                }}
                autoComplete="name"
                data-testid="course-guest-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-guest-email">Email</Label>
              <Input
                id="course-guest-email"
                type="email"
                value={guestEmail}
                onChange={(e) => {
                  setGuestEmail(e.target.value)
                  if (settledGuest) setSettledGuest(null)
                }}
                autoComplete="email"
                data-testid="course-guest-email"
              />
            </div>
            {guestFormError ? (
              <p className="text-sm text-destructive" role="alert">
                {guestFormError}
              </p>
            ) : null}
            {!settledGuest ? (
              <Button type="submit" className="w-full" data-testid="course-guest-checkout-continue">
                Continue to payment
              </Button>
            ) : null}
          </form>

          {settledGuest ? (
            <>
              <CheckoutForm
                price={price}
                priceComponent={priceComponent}
                createPaymentIntentUrl="/api/courses/guest-checkout"
                returnUrl={successUrl}
                metadata={{
                  courseId: String(courseId),
                  guestName: settledGuest.name,
                  guestEmail: settledGuest.email,
                }}
              />
              {checkoutLegal ? (
                <CheckoutLegalAcceptance
                  config={checkoutLegal}
                  agreementPrefix="By enrolling in this course, you agree to our"
                />
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter your details, then continue when your email is complete.
            </p>
          )}
        </div>
      )}
    </aside>
  )
}
