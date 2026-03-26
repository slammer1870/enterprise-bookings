import { test, expect } from './helpers/fixtures'
import { navigateToTenant } from './helpers/subdomain-helpers'
import { getPayloadInstance } from './helpers/data-helpers'

const createRichTextWithParagraphs = (paragraphs: string[]) => ({
  root: {
    type: 'root' as const,
    children: paragraphs.map((text) => ({
      type: 'paragraph' as const,
      children: [
        {
          type: 'text' as const,
          detail: 0,
          format: 0,
          mode: 'normal' as const,
          style: '',
          text,
          version: 1,
        },
      ],
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      textFormat: 0,
      version: 1,
    })),
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
})

test.describe('Form submissions', () => {
  test('public FormBlock submits successfully on tenant subdomain', async ({ page, testData }) => {
    const payload = await getPayloadInstance()
    const tenantId = testData.tenants[0]?.id
    const tenantSlug = testData.tenants[0]?.slug
    const w = testData.workerIndex

    if (!tenantId || !tenantSlug) throw new Error('Tenant required')

    // Enable the Form block for this tenant (default blocks do not include it).
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        allowedBlocks: ['formBlock'],
      },
      overrideAccess: true,
    })

    // Create a simple form (tenant-scoped) and a page that renders it.
    const unique = `${Date.now()}-w${w}`
    const form = (await payload.create({
      collection: 'forms',
      data: {
        tenant: tenantId,
        title: `E2E Form ${unique}`,
        fields: [
          { blockType: 'text', name: 'firstName', label: 'First name', required: true },
          { blockType: 'email', name: 'email', label: 'Email', required: true },
          { blockType: 'textarea', name: 'message', label: 'Message', required: true },
        ],
        submitButtonLabel: 'Send',
        confirmationType: 'message',
        confirmationMessage: createRichTextWithParagraphs(['Thanks — we got your submission.']),
      },
      overrideAccess: true,
    })) as { id: number }

    const pageSlug = `form-test-${unique}`
    await payload.create({
      collection: 'pages',
      data: {
        tenant: tenantId,
        slug: pageSlug,
        title: `Form Test ${unique}`,
        _status: 'published',
        layout: [
          {
            blockType: 'formBlock',
            enableIntro: false,
            form: form.id,
          },
        ],
      },
      draft: false,
      overrideAccess: true,
    })

    // Navigate to tenant page and submit the form.
    await navigateToTenant(page, tenantSlug, `/${pageSlug}`)
    await expect(page.locator('form')).toBeVisible()

    // Hydration guard: ensure inputs are interactive before submitting.
    await page.locator('#firstName').fill('Sam')
    await page.locator('#email').fill(`sam+${unique}@example.com`)
    await page.locator('#message').fill('Hello from Playwright.')

    const submissionResponse = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/api/form-submissions'),
      { timeout: 15_000 },
    )

    await Promise.all([submissionResponse, page.getByRole('button', { name: 'Send' }).click()])

    const res = await submissionResponse
    if (res.status() >= 300) {
      const body = await res.text().catch(() => '')
      throw new Error(
        [
          `Expected /api/form-submissions to return 2xx, got ${res.status()}`,
          body ? `Response body:\n${body.slice(0, 2000)}` : 'Response body: (empty)',
        ].join('\n\n'),
      )
    }

    await expect(page.getByText(/thanks/i)).toBeVisible({ timeout: 10_000 })
  })
})

