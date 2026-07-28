'use client'

/**
 * Gift voucher checkout: name, email, amount + Stripe Payment Element.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  PaymentElement,
  useStripe,
  useElements,
  Elements,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Button } from '@repo/ui/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CheckoutLegalAcceptance,
  type CheckoutLegalConfig,
} from '@repo/payments-next'
import { GIFT_VOUCHER_MIN_EUROS, GIFT_VOUCHER_MAX_EUROS } from '@/lib/stripe-connect/giftVoucherConstants'

const stripePromiseByAccount = new Map<string, ReturnType<typeof loadStripe>>()
let stripePromise: ReturnType<typeof loadStripe> | null = null

function getStripePromise(stripeAccountId?: string | null) {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) return null
  const acct =
    typeof stripeAccountId === 'string' && stripeAccountId.trim()
      ? stripeAccountId.trim()
      : null
  if (!acct) {
    if (stripePromise) return stripePromise
    stripePromise = loadStripe(key)
    return stripePromise
  }
  const existing = stripePromiseByAccount.get(acct)
  if (existing) return existing
  const created = loadStripe(key, { stripeAccount: acct })
  stripePromiseByAccount.set(acct, created)
  return created
}

export type GiftVoucherCheckoutUser = {
  id: number
  email: string
  name?: string | null
} | null

export type GiftVoucherCheckoutFormProps = {
  heading?: string | null
  minAmount?: number | null
  maxAmount?: number | null
  checkoutLegal?: CheckoutLegalConfig | null
  /** Pre-resolved session user (null = guest). Used to prefill name/email. */
  user: GiftVoucherCheckoutUser
}

function PaymentStep({
  voucherAmount,
  bookingFeeAmount,
  totalAmount,
  onBack,
  checkoutLegal,
  deliveryEmail,
}: {
  voucherAmount: number
  bookingFeeAmount: number
  totalAmount: number
  onBack: () => void
  checkoutLegal?: CheckoutLegalConfig | null
  deliveryEmail: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [paymentReady, setPaymentReady] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setIsLoading(true)
    setMessage(null)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setMessage(submitError.message ?? 'Please complete your payment details.')
      setIsLoading(false)
      return
    }

    const returnUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?success=1`
        : '/?success=1'
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    })
    if (error?.message) setMessage(error.message)
    setIsLoading(false)
  }

  const canPay = Boolean(stripe && elements && paymentReady && paymentComplete && !isLoading)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>
          Gift voucher: <span className="font-medium text-foreground">€{voucherAmount.toFixed(2)}</span>
          {bookingFeeAmount > 0 ? (
            <>
              {' '}
              · Platform fee:{' '}
              <span className="font-medium text-foreground">€{bookingFeeAmount.toFixed(2)}</span>
            </>
          ) : null}
        </p>
        <p>
          Total to pay:{' '}
          <span className="font-medium text-foreground">€{totalAmount.toFixed(2)}</span>. Your code
          will be emailed to <span className="font-medium text-foreground">{deliveryEmail}</span>.
        </p>
      </div>
      <PaymentElement
        onReady={() => setPaymentReady(true)}
        onChange={(event) => setPaymentComplete(Boolean(event.complete))}
      />
      {!paymentReady ? (
        <p className="text-sm text-muted-foreground" data-testid="gift-voucher-payment-loading">
          Loading payment form…
        </p>
      ) : null}
      {checkoutLegal ? (
        <CheckoutLegalAcceptance
          config={checkoutLegal}
          agreementPrefix="By purchasing this gift voucher, you agree to our"
        />
      ) : null}
      {message && (
        <p className="text-sm text-red-600" role="alert">
          {message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
          Back
        </Button>
        <Button type="submit" disabled={!canPay}>
          {isLoading ? 'Processing…' : `Pay €${totalAmount.toFixed(2)}`}
        </Button>
      </div>
    </form>
  )
}

export function GiftVoucherCheckoutForm(props: GiftVoucherCheckoutFormProps) {
  const user = props.user

  const minAmount = useMemo(() => {
    const raw = typeof props.minAmount === 'number' ? props.minAmount : GIFT_VOUCHER_MIN_EUROS
    return Math.max(GIFT_VOUCHER_MIN_EUROS, raw)
  }, [props.minAmount])

  const maxAmount = useMemo(() => {
    if (typeof props.maxAmount === 'number' && props.maxAmount > 0) {
      return Math.min(GIFT_VOUCHER_MAX_EUROS, props.maxAmount)
    }
    return GIFT_VOUCHER_MAX_EUROS
  }, [props.maxAmount])

  const [amount, setAmount] = useState(String(minAmount))
  const [name, setName] = useState(() =>
    typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : '',
  )
  const [email, setEmail] = useState(() =>
    typeof user?.email === 'string' && user.email.trim() ? user.email.trim() : '',
  )
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [voucherAmount, setVoucherAmount] = useState<number | null>(null)
  const [bookingFeeAmount, setBookingFeeAmount] = useState(0)
  const [totalAmount, setTotalAmount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === '1') {
      setShowSuccess(true)
    }
  }, [])

  const deliveryEmail = email.trim()

  const parseAmount = (): number | null => {
    const n = Number(amount)
    if (!Number.isFinite(n)) return null
    if (n < minAmount || n > maxAmount) return null
    if (Math.abs(n * 100 - Math.round(n * 100)) > Number.EPSILON) return null
    return n
  }

  const createPaymentIntent = async () => {
    setIsCreating(true)
    setError(null)
    const parsed = parseAmount()
    if (parsed == null) {
      setError(`Enter an amount between €${minAmount.toFixed(2)} and €${maxAmount.toFixed(2)}`)
      setIsCreating(false)
      return
    }
    if (!name.trim()) {
      setError('Name is required')
      setIsCreating(false)
      return
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('A valid email is required')
      setIsCreating(false)
      return
    }

    try {
      const res = await fetch('/api/stripe/connect/purchase-gift-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: parsed,
          name: name.trim(),
          email: email.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`)
        return
      }
      if (data.clientSecret) {
        setClientSecret(data.clientSecret)
        setVoucherAmount(parsed)
        const feeCents =
          typeof data.bookingFeeAmountCents === 'number' && Number.isFinite(data.bookingFeeAmountCents)
            ? data.bookingFeeAmountCents
            : 0
        const totalCents =
          typeof data.totalAmountCents === 'number' && Number.isFinite(data.totalAmountCents)
            ? data.totalAmountCents
            : Math.round(parsed * 100) + feeCents
        setBookingFeeAmount(feeCents / 100)
        setTotalAmount(totalCents / 100)
        setStripeAccountId(
          typeof data.stripeAccountId === 'string' && data.stripeAccountId.trim()
            ? data.stripeAccountId.trim()
            : null,
        )
      } else {
        setError('Missing payment details')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setIsCreating(false)
    }
  }

  const heading = props.heading?.trim() || 'Buy a gift voucher'

  if (showSuccess) {
    return (
      <div className="mx-auto w-full max-w-md space-y-3" data-testid="gift-voucher-success">
        <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
        <p className="text-sm text-muted-foreground">
          Payment successful. Your gift voucher code has been emailed to you. Check your inbox
          (and spam folder) shortly.
        </p>
      </div>
    )
  }

  if (clientSecret && voucherAmount != null && totalAmount != null) {
    const isTestClientSecret =
      typeof clientSecret === 'string' && /^pi_test_.*_secret_test$/.test(clientSecret)
    const stripe = getStripePromise(stripeAccountId)
    if (!stripe || isTestClientSecret) {
      return (
        <div className="mx-auto w-full max-w-md space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
          <p className="text-sm text-muted-foreground" data-testid="stripe-not-configured">
            {isTestClientSecret
              ? 'Payment form not available in test mode.'
              : 'Payments are not available in this environment.'}
          </p>
          <Button type="button" variant="outline" onClick={() => setClientSecret(null)}>
            Back
          </Button>
        </div>
      )
    }
    return (
      <div className="mx-auto w-full max-w-md space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
        <Elements
          stripe={stripe}
          options={{
            clientSecret,
            appearance: { theme: 'stripe' },
          }}
        >
          <PaymentStep
            voucherAmount={voucherAmount}
            bookingFeeAmount={bookingFeeAmount}
            totalAmount={totalAmount}
            onBack={() => {
              setClientSecret(null)
              setVoucherAmount(null)
              setTotalAmount(null)
              setBookingFeeAmount(0)
            }}
            checkoutLegal={props.checkoutLegal}
            deliveryEmail={deliveryEmail}
          />
        </Elements>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4" data-testid="gift-voucher-checkout">
      <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
      <p className="text-sm text-muted-foreground">
        Choose a gift voucher amount. After payment, a one-time discount code for that value will
        be emailed to the address you enter below. The code can be used at checkout for a drop-in,
        class pass, or membership.
      </p>

      <div className="space-y-2">
        <Label htmlFor="gift-voucher-name">Name</Label>
        <Input
          id="gift-voucher-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gift-voucher-email">Email</Label>
        <Input
          id="gift-voucher-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gift-voucher-amount">Amount (€)</Label>
        <Input
          id="gift-voucher-amount"
          type="number"
          min={minAmount}
          max={maxAmount}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Min €{minAmount.toFixed(2)}
          {maxAmount < GIFT_VOUCHER_MAX_EUROS ? ` · Max €${maxAmount.toFixed(2)}` : ''}
          {' · '}A platform fee may be added at checkout.
        </p>
      </div>

      {props.checkoutLegal ? (
        <CheckoutLegalAcceptance
          config={props.checkoutLegal}
          agreementPrefix="By purchasing this gift voucher, you agree to our"
        />
      ) : null}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <Button
        type="button"
        onClick={createPaymentIntent}
        disabled={isCreating || !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
      >
        {isCreating ? 'Loading…' : 'Continue to payment'}
      </Button>
    </div>
  )
}
