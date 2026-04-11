import { APIError, type Endpoint } from 'payload'

import { updateStripeSubscriptionForDocument } from '@/lib/stripe-connect/admin'

const allowedActions = new Set(['cancel_now', 'cancel_at_period_end', 'resume'])

export const updateStripeSubscriptionEndpoint: Endpoint = {
  path: '/admin/stripe/subscriptions/:id/update',
  method: 'post',
  handler: async (req) => {
    const idParam = req.routeParams?.id
    const id = typeof idParam === 'string' || typeof idParam === 'number' ? idParam : null
    if (!id) throw new APIError('Subscription ID is required', 400)
    if (!req.json) throw new APIError('Invalid request body', 400)

    const body = (await req.json().catch(() => null)) as { action?: unknown } | null
    const action = typeof body?.action === 'string' ? body.action : null
    if (!action || !allowedActions.has(action)) {
      throw new APIError('Unsupported subscription action', 400)
    }

    try {
      const result = await updateStripeSubscriptionForDocument(
        req,
        id,
        action as 'cancel_now' | 'cancel_at_period_end' | 'resume',
      )
      return Response.json({ ok: true, ...result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update Stripe subscription'
      const status =
        message === 'Unauthorized' ? 401 :
        message === 'Forbidden' ? 403 :
        400
      throw new APIError(message, status)
    }
  },
}
