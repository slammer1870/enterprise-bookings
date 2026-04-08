import { APIError, type Endpoint } from 'payload'

import { createStripeSubscriptionForDocument } from '@/lib/stripe-connect/admin'

export const createSubscriptionInStripeEndpoint: Endpoint = {
  path: '/admin/stripe/subscriptions/:id/create',
  method: 'post',
  handler: async (req) => {
    const idParam = req.routeParams?.id
    const id = typeof idParam === 'string' || typeof idParam === 'number' ? idParam : null
    if (!id) throw new APIError('Subscription ID is required', 400)

    try {
      const result = await createStripeSubscriptionForDocument(req, id)
      return Response.json({ ok: true, ...result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create Stripe subscription'
      const status =
        message === 'Unauthorized' ? 401 :
        message === 'Forbidden' ? 403 :
        400
      throw new APIError(message, status)
    }
  },
}
