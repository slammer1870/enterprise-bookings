import type { APIRequestContext } from '@playwright/test'

export async function mockSubscriptionCreatedWebhook(
  request: APIRequestContext,
  options: { lessonId: number; userEmail: string },
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const req: any = request as any
  // Next.js lazily compiles route handlers on first hit; in CI this can exceed Playwright's default 10s request timeout.
  // Warm the route (GET will 405, but still forces compilation) and then POST with a larger timeout.
  await req
    .get(`${baseUrl}/api/test/mock-subscription-created-webhook`, { timeout: 120000 })
    .catch(() => {})

  const res = await req.post(`${baseUrl}/api/test/mock-subscription-created-webhook`, {
    timeout: 120000,
    data: { lessonId: options.lessonId, userEmail: options.userEmail },
  })
  if (!res.ok()) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Failed to trigger subscription webhook: ${res.status()} ${txt}`)
  }
}

export async function mockPaymentIntentSucceededWebhook(
  request: APIRequestContext,
  options: { lessonId: number; userEmail: string },
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const req: any = request as any
  const webhookResponse = await req.post(`${baseUrl}/api/test/mock-payment-intent-webhook`, {
    data: {
      userEmail: options.userEmail,
      event: {
        data: {
          object: {
            id: `pi_test_${Date.now()}`,
            customer: '',
            metadata: { lessonId: options.lessonId.toString() },
          },
        },
      },
    },
  })

  if (!webhookResponse.ok()) {
    const errorText = await webhookResponse.text().catch(() => 'Unknown error')
    throw new Error(`Failed to trigger webhook: ${webhookResponse.status()} - ${errorText}`)
  }
}


