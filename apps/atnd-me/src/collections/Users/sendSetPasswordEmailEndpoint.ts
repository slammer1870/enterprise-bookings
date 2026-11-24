import { APIError, type Endpoint } from 'payload'

import { sendSetPasswordEmailForUser } from './sendSetPasswordEmail'

export const sendSetPasswordEmailEndpoint: Endpoint = {
  path: '/:id/send-set-password-email',
  method: 'post',
  handler: async (req) => {
    try {
      await sendSetPasswordEmailForUser(req, req.routeParams?.id)
    } catch (error) {
      if (error instanceof APIError) throw error
      throw new APIError('Could not email a link for this person to set their password.', 400)
    }
    return Response.json({ ok: true })
  },
}
