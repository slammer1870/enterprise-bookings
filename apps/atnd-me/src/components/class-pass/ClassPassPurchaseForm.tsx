'use client'

/**
 * Step 6 – Minimal class pass purchase: quantity + Stripe Payment Element.
 * Expects NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY for Stripe.js.
 */
import { useState } from 'react'
import {
  PaymentElement,
  useStripe,
  useElements,
  Elements,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Button } from '@repo/ui/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Label } from '@repo/ui/components/ui/label'

const stripePromiseByAccount = new Map<string, ReturnType<typeof loadStripe>>()
let stripePromise: ReturnType<typeof loadStripe> | null = null
function getStripePromise(stripeAccountId?: string | null) {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) return null
  const acct = typeof stripeAccountId === 'string' && stripeAccountId.trim() ? stripeAccountId.trim() : null
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

type ClassPassPurchaseFormProps = {
  defaultQuantity?: number
}

function PaymentStep({ onBack }: { clientSecret: string; onBack: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setIsLoading(true)
    setMessage(null)
    const returnUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/class-passes/purchase?success=1`
      : '/class-passes/purchase?success=1'
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    })
    if (error?.message) setMessage(error.message)
    setIsLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete payment</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PaymentElement />
          {message && (
            <p className="text-sm text-red-600" role="alert">{message}</p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
              Back
            </Button>
            <Button type="submit" disabled={!stripe || !elements || isLoading}>
              {isLoading ? 'Processing…' : 'Pay now'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function ClassPassPurchaseForm({ defaultQuantity = 1 }: ClassPassPurchaseFormProps) {
  const [quantity, setQuantity] = useState(defaultQuantity)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const createPaymentIntent = async () => {
    setIsCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/class-passes/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ quantity }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? `Request failed (${res.status})`)
        return
      }
      if (data.clientSecret) {
        setClientSecret(data.clientSecret)
        setStripeAccountId(
          typeof data.stripeAccountId === 'string' && data.stripeAccountId.trim()
            ? data.stripeAccountId.trim()
            : null
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

  if (clientSecret) {
    const isTestClientSecret =
      typeof clientSecret === 'string' && /^pi_test_.*_secret_test$/.test(clientSecret)
    const stripe = getStripePromise(stripeAccountId)
    if (!stripe || isTestClientSecret) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Complete payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground" data-testid="stripe-not-configured">
              {isTestClientSecret
                ? 'Payment form not available in test mode.'
                : 'Payments are not available in this environment.'}
            </div>
            <Button type="button" variant="outline" onClick={() => setClientSecret(null)}>
              Back
            </Button>
          </CardContent>
        </Card>
      )
    }
    return (
      <Elements
        stripe={stripe}
        options={{
          clientSecret,
          appearance: { theme: 'stripe' },
        }}
      >
        <PaymentStep
          clientSecret={clientSecret}
          onBack={() => setClientSecret(null)}
        />
      </Elements>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buy class pass</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="quantity">Number of classes</Label>
          <input
            id="quantity"
            type="number"
            min={1}
            max={100}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(String(e.target.value), 10) || 1)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">{error}</p>
        )}
        <Button
          onClick={createPaymentIntent}
          disabled={isCreating || !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
        >
          {isCreating ? 'Loading…' : 'Continue to payment'}
        </Button>
      </CardContent>
    </Card>
  )
}
