import { APIError, type Endpoint } from 'payload'

import { getStripeDashboardLinkForDocument } from '@/lib/stripe-connect/admin'

const allowedTargets = new Set(['account', 'customer', 'product', 'subscription', 'promotion-code'])

export const stripeDashboardLinkEndpoint: Endpoint = {
  path: '/admin/stripe/dashboard-link/:collection/:id/:target',
  method: 'get',
  handler: async (req) => {
    const collectionParam = req.routeParams?.collection
    const idParam = req.routeParams?.id
    const targetParam = req.routeParams?.target
    const collection = typeof collectionParam === 'string' ? collectionParam : null
    const id = typeof idParam === 'string' || typeof idParam === 'number' ? idParam : null
    const target = typeof targetParam === 'string' ? targetParam : null

    if (!collection || !id || !target) {
      throw new APIError('Collection, ID, and target are required', 400)
    }

    if (!allowedTargets.has(target)) {
      throw new APIError('Unsupported Stripe dashboard target', 400)
    }

    try {
      const url = await getStripeDashboardLinkForDocument({
        payload: req.payload,
        user: req.user,
        collection,
        id,
        target: target as 'account' | 'customer' | 'product' | 'subscription' | 'promotion-code',
      })

      return Response.json({ url })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resolve Stripe dashboard link'
      const status =
        message === 'Unauthorized' ? 401 :
        message === 'Forbidden' ? 403 :
        400
      throw new APIError(message, status)
    }
  },
}
