import type { APIRequestContext } from '@playwright/test'

const MAGIC_LINK_ENDPOINT = '/api/test/magic-links'

type MagicLinkResponse = {
  email: string
  token: string
  url: string
  createdAt: number
}

/**
 * Clear stored magic links for a specific email or all (test-only endpoint).
 */
export async function clearTestMagicLinks(request: APIRequestContext, email?: string) {
  const req: any = request as any
  const endpoint = email
    ? `${MAGIC_LINK_ENDPOINT}?email=${encodeURIComponent(email)}`
    : MAGIC_LINK_ENDPOINT

  const res = await req.delete(endpoint).catch(() => null)
  if (res && res.status() === 404) {
    throw new Error(
      'Test magic link endpoint is disabled. Ensure NODE_ENV=test or ENABLE_TEST_MAGIC_LINKS=true.',
    )
  }
}

/**
 * Poll the test magic-link endpoint for the most recent link for an email.
 */
export async function pollForTestMagicLink(
  request: APIRequestContext,
  email: string,
  attempts = 10,
  delayMs = 1000,
): Promise<MagicLinkResponse> {
  const req: any = request as any
  const endpoint = `${MAGIC_LINK_ENDPOINT}?email=${encodeURIComponent(email)}`

  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await req.get(endpoint).catch(() => null)
    if (res?.ok()) {
      const body = (await res.json()) as MagicLinkResponse
      if (body?.url) return body
    } else if (res?.status() === 404) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (body?.error === 'Not found') {
        throw new Error(
          'Test magic link endpoint is disabled. Ensure NODE_ENV=test or ENABLE_TEST_MAGIC_LINKS=true.',
        )
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  throw new Error(`Magic link not found for ${email} after ${attempts} attempts`)
}


