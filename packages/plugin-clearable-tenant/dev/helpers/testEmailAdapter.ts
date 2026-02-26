import type { EmailAdapter, SendEmailOptions } from 'payload'

/**
 * Logs all emails to stdout. Use in dev/test so no real email is sent.
 */
export const testEmailAdapter: EmailAdapter = ({ payload }) => ({
  name: 'test-email-adapter',
  defaultFromAddress: 'dev@payloadcms.com',
  defaultFromName: 'Payload Test',
  sendEmail: async (message) => {
    const stringifiedTo = getStringifiedToAddress(message)
    payload.logger.info({ msg: `Test email to: '${stringifiedTo}', Subject: '${message.subject}'` })
    return Promise.resolve()
  },
})

function getStringifiedToAddress(message: SendEmailOptions): string | undefined {
  if (typeof message.to === 'string') return message.to
  if (Array.isArray(message.to)) {
    return message.to
      .map((to: { address: string } | string) =>
        typeof to === 'string' ? to : to?.address ?? '',
      )
      .join(', ')
  }
  return message.to?.address
}
