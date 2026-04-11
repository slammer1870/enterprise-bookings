'use client'

import * as React from 'react'
import { toast, useDocumentInfo, useFormFields } from '@payloadcms/ui'

export const CreateStripeSubscriptionButton: React.FC = () => {
  const { id } = useDocumentInfo()
  const stripeSubscriptionIdField = useFormFields(([fields]) => fields.stripeSubscriptionId)
  const statusField = useFormFields(([fields]) => fields.status)
  const cancelAtField = useFormFields(([fields]) => fields.cancelAt)
  const [submitting, setSubmitting] = React.useState(false)

  const docId = typeof id === 'string' || typeof id === 'number' ? String(id) : ''
  const stripeSubscriptionId =
    typeof stripeSubscriptionIdField?.value === 'string' ? stripeSubscriptionIdField.value.trim() : ''
  const status = typeof statusField?.value === 'string' ? statusField.value : ''
  const cancelAt = typeof cancelAtField?.value === 'string' ? cancelAtField.value : null

  const runAction = async (action: 'create' | 'cancel_now' | 'cancel_at_period_end' | 'resume') => {
    setSubmitting(true)
    try {
      const endpoint =
        action === 'create'
          ? `/api/admin/stripe/subscriptions/${encodeURIComponent(docId)}/create`
          : `/api/admin/stripe/subscriptions/${encodeURIComponent(docId)}/update`
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: action === 'create' ? undefined : { 'Content-Type': 'application/json' },
        body: action === 'create' ? undefined : JSON.stringify({ action }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        message?: string
        stripeSubscriptionId?: string
        cancelAt?: string | null
      }
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update subscription in Stripe')
      }

      if (action === 'create') {
        toast.success(
          data.stripeSubscriptionId
            ? `Created Stripe subscription ${data.stripeSubscriptionId}`
            : 'Created Stripe subscription',
        )
      } else if (action === 'cancel_now') {
        toast.success('Canceled subscription in Stripe')
      } else if (action === 'cancel_at_period_end') {
        toast.success(
          data.cancelAt ? `Subscription will cancel on ${data.cancelAt}` : 'Scheduled cancellation in Stripe',
        )
      } else {
        toast.success('Removed scheduled cancellation in Stripe')
      }
      window.location.reload()
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update subscription in Stripe')
    } finally {
      setSubmitting(false)
    }
  }

  if (!docId) {
    return (
      <div className="mb-4">
        <p className="label">Stripe subscription actions</p>
        <p style={{ color: 'var(--theme-elevation-400)' }}>Save the subscription first.</p>
      </div>
    )
  }

  const isCanceled = status === 'canceled'
  const hasStripeSubscription = stripeSubscriptionId.length > 0

  return (
    <div className="mb-4">
      <p className="label">Stripe subscription actions</p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {!hasStripeSubscription ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void runAction('create')}
            style={buttonStyle(submitting)}
          >
            {submitting ? 'Working...' : 'Create in Stripe'}
          </button>
        ) : null}
        {hasStripeSubscription && !isCanceled ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void runAction('cancel_now')}
            style={buttonStyle(submitting)}
          >
            {submitting ? 'Working...' : 'Cancel in Stripe'}
          </button>
        ) : null}
        {hasStripeSubscription && !isCanceled && !cancelAt ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void runAction('cancel_at_period_end')}
            style={buttonStyle(submitting)}
          >
            {submitting ? 'Working...' : 'Cancel at period end'}
          </button>
        ) : null}
        {hasStripeSubscription && !isCanceled && cancelAt ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void runAction('resume')}
            style={buttonStyle(submitting)}
          >
            {submitting ? 'Working...' : 'Resume in Stripe'}
          </button>
        ) : null}
      </div>
      {hasStripeSubscription ? (
        <p style={{ color: 'var(--theme-elevation-400)', marginTop: '0.5rem' }}>
          Manage lifecycle in Stripe here. Local `status` and `cancelAt` should be treated as synced fields.
        </p>
      ) : null}
    </div>
  )
}

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid var(--theme-elevation-250)',
    background: 'var(--theme-elevation-0)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

export default CreateStripeSubscriptionButton
