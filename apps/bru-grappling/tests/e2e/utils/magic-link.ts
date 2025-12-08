import { Page, expect } from '@playwright/test'

/**
 * Utility functions for testing magic link authentication
 * These functions intercept and mock the magic link verification process
 */

/**
 * Extract magic link token from console logs or network requests
 * Since sendMagicLink logs to console, we can intercept it
 */
export async function captureMagicLinkFromConsole(page: Page): Promise<string | null> {
  // Listen for console logs that contain magic link information
  const magicLinkPromise = new Promise<string | null>((resolve) => {
    const timeout = setTimeout(() => resolve(null), 10000) // 10 second timeout

    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('magic link') || text.includes('token') || text.includes('url')) {
        // Try to extract URL from console log
        const urlMatch = text.match(/https?:\/\/[^\s]+/)?.[0]
        if (urlMatch) {
          clearTimeout(timeout)
          resolve(urlMatch)
        }
      }
    })
  })

  return magicLinkPromise
}

/**
 * Extract token from magic link URL
 */
export function extractTokenFromMagicLink(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const token = urlObj.searchParams.get('token')
    return token
  } catch (e) {
    // Try regex fallback
    const tokenMatch = url.match(/[?&]token=([^&]+)/)
    return tokenMatch ? tokenMatch[1] : null
  }
}

/**
 * Complete magic link authentication by navigating to Better Auth verify endpoint
 * This mocks clicking the magic link in an email
 * Better Auth uses /api/auth/verify-magic-link with token as query parameter
 */
export async function verifyMagicLink(
  page: Page,
  token: string,
  callbackUrl?: string,
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  
  // Better Auth verify endpoint: /api/auth/verify-magic-link?token=...
  const verifyUrl = new URL('/api/auth/verify-magic-link', baseUrl)
  verifyUrl.searchParams.set('token', token)
  if (callbackUrl) {
    verifyUrl.searchParams.set('callbackURL', callbackUrl) // Better Auth uses callbackURL
  }

  // Navigate to verify endpoint
  await page.goto(verifyUrl.toString(), { waitUntil: 'load', timeout: 60000 })
  
  // Wait for redirect after verification
  await page.waitForTimeout(2000)
  
  // Should redirect to callback URL or dashboard/home
  if (callbackUrl) {
    try {
      await page.waitForURL(new RegExp(callbackUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), {
        timeout: 10000,
      })
    } catch (e) {
      // Might redirect to dashboard or home instead
      await page.waitForTimeout(2000)
    }
  } else {
    // Wait for any redirect away from verify page
    await page.waitForTimeout(2000)
  }
}

/**
 * Complete magic link flow: send magic link and verify it
 * This is a helper that combines sending and verifying
 */
export async function completeMagicLinkAuth(
  page: Page,
  email: string,
  callbackUrl?: string,
): Promise<void> {
  // Step 1: Navigate to sign-in and request magic link
  await page.goto('/auth/sign-in', { waitUntil: 'load', timeout: 60000 })
  await page.waitForLoadState('domcontentloaded')

  // Step 2: Click magic link button
  const magicLinkButton = page.getByRole('button', { name: /magic link/i })
  await expect(magicLinkButton).toBeVisible({ timeout: 10000 })
  
  await magicLinkButton.click()
  await page.waitForTimeout(1000)

  // Step 3: Fill email and submit
  const emailInput = page.getByRole('textbox', { name: /email/i })
  const hasEmailInput = await emailInput.isVisible({ timeout: 3000 }).catch(() => false)

  if (hasEmailInput) {
    await emailInput.fill(email)
    
    const submitButton = page.getByRole('button', { name: /submit|send/i })
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click()
      await page.waitForTimeout(2000)
    }
  } else {
    // Email might already be filled or form submitted automatically
    await page.waitForTimeout(2000)
  }

  // Step 4: Intercept network request to capture magic link token
  // Better Auth sends magic link via API call
  let magicLinkToken: string | null = null

  // Listen for API response that contains the magic link
  const responsePromise = page.waitForResponse(
    (response) => {
      const url = response.url()
      return url.includes('/api/auth/magic-link') || url.includes('magic-link')
    },
    { timeout: 10000 },
  ).catch(() => null)

  // Also check console logs
  const consolePromise = captureMagicLinkFromConsole(page)

  // Wait for either response or console log
  await Promise.race([responsePromise, consolePromise])

  // Step 5: Try to get token from API response
  try {
    const response = await responsePromise
    if (response) {
      const responseData = await response.json().catch(() => null)
      if (responseData?.token || responseData?.url) {
        const url = responseData.url || responseData.token
        magicLinkToken = extractTokenFromMagicLink(url) || responseData.token
      }
    }
  } catch (e) {
    // Response might not have token in body
  }

  // Step 6: If we have token, verify it
  if (magicLinkToken) {
    await verifyMagicLink(page, magicLinkToken, callbackUrl)
  } else {
    // Fallback: Try to create token manually using Payload's verify endpoint
    // This requires knowing the user ID, so we'll need to fetch it
    await verifyMagicLinkViaPayload(page, email, callbackUrl)
  }
}

/**
 * Alternative: Verify magic link using Payload's verify endpoint
 * This requires creating a valid JWT token
 */
async function verifyMagicLinkViaPayload(
  page: Page,
  email: string,
  callbackUrl?: string,
): Promise<void> {
  // This would require:
  // 1. Finding the user by email
  // 2. Creating a JWT token with the user ID
  // 3. Calling the verify endpoint
  
  // For now, we'll use a simpler approach: intercept the network request
  // and extract the token from the response headers or body
  
  // Better approach: Use Playwright's route interception to capture the token
  // when the magic link is sent
  throw new Error(
    'Magic link token not captured. Consider using route interception to capture token from API response.',
  )
}

/**
 * Intercept Better Auth magic link API call and capture token
 * Better Auth sends magic link via /api/auth/sign-in-magic-link
 * The token is logged to console and also available in the response
 */
export async function interceptMagicLinkRequest(page: Page): Promise<Promise<string | null>> {
  let magicLinkToken: string | null = null
  let resolveToken: (token: string | null) => void

  const tokenPromise = new Promise<string | null>((resolve) => {
    resolveToken = resolve
  })

  // Intercept Better Auth API requests
  page.route('**/api/auth/**', async (route) => {
    const request = route.request()
    const url = request.url()
    const method = request.method()

    // Better Auth magic link sign-in endpoint
    if (url.includes('sign-in-magic-link') && method === 'POST') {
      // Let the request proceed
      const response = await route.fetch()
      const responseData = await response.json().catch(() => null)

      // Better Auth might return token in response or we need to extract from console log
      if (responseData?.token) {
        magicLinkToken = responseData.token
      } else if (responseData?.url) {
        magicLinkToken = extractTokenFromMagicLink(responseData.url)
      }

      // Also listen for console logs (Better Auth logs the magic link URL)
      page.on('console', (msg) => {
        const text = msg.text()
        if (text.includes('magic link') && text.includes('url')) {
          const urlMatch = text.match(/https?:\/\/[^\s]+/)?.[0]
          if (urlMatch) {
            const token = extractTokenFromMagicLink(urlMatch)
            if (token) {
              magicLinkToken = token
              resolveToken(token)
            }
          }
        }
      })

      if (magicLinkToken) {
        resolveToken(magicLinkToken)
      }

      // Continue with the response
      await route.fulfill({ response })
    } else {
      // Continue normally for other requests
      await route.continue()
    }
  })

  return tokenPromise
}

/**
 * Complete magic link auth with Better Auth
 * Intercepts the magic link token from console logs or API responses
 */
export async function completeMagicLinkAuthWithInterception(
  page: Page,
  email: string,
  callbackUrl?: string,
): Promise<void> {
  // Set up console log listener to capture magic link token
  // Better Auth logs the magic link URL to console via sendMagicLink callback
  let magicLinkToken: string | null = null
  let magicLinkUrl: string | null = null

  const consoleListener = (msg: any) => {
    const text = msg.text()
    // Better Auth logs: "Send magic link for user: email token url"
    if (text.includes('magic link') && text.includes('user:')) {
      // Extract URL from console log
      const urlMatch = text.match(/https?:\/\/[^\s]+/)?.[0]
      if (urlMatch) {
        magicLinkUrl = urlMatch
        magicLinkToken = extractTokenFromMagicLink(urlMatch)
      }
      // Also try to extract token directly if logged separately
      const tokenMatch = text.match(/token[:\s]+([^\s]+)/i)?.[1]
      if (tokenMatch && !magicLinkToken) {
        magicLinkToken = tokenMatch
      }
    }
  }

  page.on('console', consoleListener)

  // Also intercept API responses
  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('/api/auth/sign-in-magic-link') || url.includes('/api/auth/magic-link')) {
      try {
        const data = await response.json().catch(() => null)
        if (data?.token) {
          magicLinkToken = data.token
        } else if (data?.url) {
          magicLinkUrl = data.url
          magicLinkToken = extractTokenFromMagicLink(data.url)
        }
      } catch (e) {
        // Response might not be JSON
      }
    }
  })

  // Request magic link
  await page.goto('/auth/sign-in', { waitUntil: 'load', timeout: 60000 })
  await page.waitForLoadState('domcontentloaded')

  const magicLinkButton = page.getByRole('button', { name: /magic link/i })
  await expect(magicLinkButton).toBeVisible({ timeout: 10000 })
  await magicLinkButton.click()
  await page.waitForTimeout(1000)

  // Fill email
  const emailInput = page.getByRole('textbox', { name: /email/i })
  const hasEmailInput = await emailInput.isVisible({ timeout: 3000 }).catch(() => false)

  if (hasEmailInput) {
    await emailInput.fill(email)
    const submitButton = page.getByRole('button', { name: /submit|send/i })
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click()
    }
  }

  // Wait for magic link to be sent (Better Auth logs it)
  await page.waitForTimeout(3000)

  // Remove console listener
  page.removeListener('console', consoleListener)

  if (magicLinkToken) {
    await verifyMagicLink(page, magicLinkToken, callbackUrl)
  } else if (magicLinkUrl) {
    // Extract token from URL if we have the URL but not the token
    magicLinkToken = extractTokenFromMagicLink(magicLinkUrl)
    if (magicLinkToken) {
      await verifyMagicLink(page, magicLinkToken, callbackUrl)
    } else {
      throw new Error('Failed to extract token from magic link URL')
    }
  } else {
    // Check if we're already authenticated (might have auto-verified)
    await page.waitForTimeout(2000)
    const currentUrl = page.url()
    if (!currentUrl.includes('/auth') && !currentUrl.includes('/magic-link-sent')) {
      // Already authenticated
      return
    }
    throw new Error('Failed to capture magic link token from Better Auth')
  }
}

