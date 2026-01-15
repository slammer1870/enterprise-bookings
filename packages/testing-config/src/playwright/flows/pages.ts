import type { Page } from '@playwright/test'
import { waitForServerReady } from '../helpers/server.js'

/**
 * Ensure there is a home page with a Schedule block.
 * If a page with slug "home" does not exist, create one via the Payload admin UI.
 *
 * This is shared across apps and uses robust selectors because Payload admin labels
 * can vary slightly between projects/configs.
 */
export async function ensureHomePageWithSchedule(page: Page): Promise<void> {
  // Warm server before first admin navigation to avoid dev-server restarts on CI
  await waitForServerReady(page.context().request)

  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  // Playwright request/context typings vary across apps/packages in this monorepo.
  // Cast to any to avoid type-level friction; these APIs are stable at runtime.
  const request: any = (page.context() as any).request
  const cookieHeader = async (): Promise<string> => {
    const cookies: Array<{ name: string; value: string }> = await (page.context() as any).cookies()
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  }

  // Always ensure we're authenticated for API writes.
  // (Callers usually run ensureAdminLoggedIn first; this is a safety net.)
  await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 120000 })

  // 1) Find existing home page by slug.
  const findRes = await request.get(`${baseUrl}/api/pages?where[slug][equals]=home&limit=1&depth=0`, {
    headers: { Cookie: await cookieHeader() },
  })
  if (!findRes.ok()) {
    throw new Error(`Failed to lookup home page: ${findRes.status()} ${findRes.statusText()}`)
  }
  const findJson: any = await findRes.json().catch(() => null)
  const existing = findJson?.docs?.[0] ?? null

  const ensureScheduleBlock = (layout: any[] | undefined | null): any[] => {
    const blocks = Array.isArray(layout) ? layout : []
    const hasSchedule = blocks.some((b) => b?.blockType === 'schedule')
    if (hasSchedule) return blocks
    // Kyuzo schedule block has no fields.
    return [...blocks, { blockType: 'schedule' }]
  }

  if (existing?.id) {
    // 2) Patch existing home page to include schedule block if missing.
    const currentLayout = existing?.layout
    const nextLayout = ensureScheduleBlock(currentLayout)
    const needsPublish = existing?._status && existing._status !== 'published'

    if (nextLayout !== currentLayout || needsPublish) {
      const patchRes = await request.patch(`${baseUrl}/api/pages/${existing.id}`, {
        headers: { Cookie: await cookieHeader(), 'Content-Type': 'application/json' },
        data: {
          layout: nextLayout,
          // Pages use draft/publish in this repo; public `/` renders published only.
          _status: 'published',
        },
      })
      if (!patchRes.ok()) {
        throw new Error(`Failed to patch home page: ${patchRes.status()} ${patchRes.statusText()}`)
      }
    }
    return
  }

  // 3) Create home page with schedule block.
  const createRes = await request.post(`${baseUrl}/api/pages`, {
    headers: { Cookie: await cookieHeader(), 'Content-Type': 'application/json' },
    data: {
      title: 'Home',
      slug: 'home',
      layout: [{ blockType: 'schedule' }],
      // Pages use draft/publish in this repo; public `/` renders published only.
      _status: 'published',
    },
  })
  if (!createRes.ok()) {
    const body = await createRes.text().catch(() => '')
    throw new Error(`Failed to create home page: ${createRes.status()} ${createRes.statusText()} ${body}`)
  }

  // Verify the page is immediately accessible (wait for any async DB writes to complete)
  for (let i = 0; i < 10; i++) {
    const verifyRes = await request.get(`${baseUrl}/api/pages?where[slug][equals]=home&limit=1&depth=0`, {
      headers: { Cookie: await cookieHeader() },
    })
    if (verifyRes.ok()) {
      const verifyJson: any = await verifyRes.json().catch(() => null)
      if (verifyJson?.docs?.[0]?.id) {
        return // Page is now accessible
      }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('Home page was created but not accessible after waiting')
}


