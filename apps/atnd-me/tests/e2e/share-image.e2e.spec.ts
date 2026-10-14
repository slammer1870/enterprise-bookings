/**
 * E2E: a served page publishes a share image from its media.
 *
 * An already-absolute media URL is that URL. A media path is
 * `https://<canonical host><path>` with no port. A page with no image
 * emits neither tag. The Open Graph page URL stays the indexed URL.
 *
 * Run from monorepo root:
 *   pnpm test:e2e:atnd-me -- share-image
 */
import type { Page, Response } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { createTestPage, createTestTenant, getPayloadInstance } from './helpers/data-helpers'
import { isNipIoDnsAvailable } from './helpers/dns-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'

const port = process.env.E2E_PORT?.trim() || '3000'

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
  'base64',
)

/** nip.io hosts share one claimed apex, so only one such tenant can exist. */
async function releaseNipIoApex(): Promise<void> {
  const payload = await getPayloadInstance()
  const existing = await payload.find({
    collection: 'tenants',
    where: { domain: { contains: 'nip.io' } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  for (const doc of existing.docs) {
    await payload.update({
      collection: 'tenants',
      id: doc.id,
      data: { domain: null },
      overrideAccess: true,
    })
  }
}

async function createPageImage(tenantId: number, mediaUrl: string): Promise<number> {
  const payload = await getPayloadInstance()
  const media = await payload.create({
    collection: 'media',
    data: {
      alt: 'Share photo',
      tenant: tenantId,
    },
    file: {
      name: `share-${tenantId}.png`,
      data: TINY_PNG,
      mimetype: 'image/png',
      size: TINY_PNG.length,
    },
    overrideAccess: true,
  })

  const updated = await payload.update({
    collection: 'media',
    id: media.id,
    data: {
      url: mediaUrl,
      sizes: {
        og: {
          url: mediaUrl,
        },
      },
    },
    overrideAccess: true,
  })

  return updated.id
}

async function createPathImage(tenantId: number, fileName: string): Promise<number> {
  const payload = await getPayloadInstance()
  const media = await payload.create({
    collection: 'media',
    data: {
      alt: 'Share photo',
      tenant: tenantId,
    },
    file: {
      name: fileName,
      data: TINY_PNG,
      mimetype: 'image/png',
      size: TINY_PNG.length,
    },
    overrideAccess: true,
  })

  await payload.update({
    collection: 'media',
    id: media.id,
    data: {
      sizes: {
        og: {
          filename: null,
          url: null,
        },
      },
    },
    overrideAccess: true,
  })

  return media.id
}

/** A scheme-less value survives upload afterRead. A leading slash would be expanded to the platform origin. */
async function storeMediaFileUrl(mediaId: number, mediaUrl: string): Promise<void> {
  const payload = await getPayloadInstance()
  await payload.update({
    collection: 'media',
    id: mediaId,
    data: { url: mediaUrl },
    overrideAccess: true,
  })
}

async function openServedPage(page: Page, host: string, pathname: string): Promise<Response | null> {
  // Next dev aborts the middleware host lookup after 2s. Compile that route first
  // so the lookup returns before the deadline. Production e2e has no deadline.
  await page.request.get(
    `http://localhost:${port}/api/tenant-by-host?host=${encodeURIComponent(host)}`,
    {
      headers: { 'x-resolve-host': host },
      timeout: 60_000,
    },
  )

  let response: Response | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await page.goto(`http://${host}:${port}${pathname}?ref=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    if (response?.status() === 200) break
  }
  return response
}

test.describe('Share image (E2E)', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  test('an already-absolute media URL is the share image', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const nipIoAvailable = await isNipIoDnsAvailable()
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    const canonicalHost = `e2e-share-${w}-${stamp}.127.0.0.1.nip.io`
    const slug = `share-${w}-${stamp}`
    const mediaUrl = 'https://files.example.com/share/photo.jpg?v=2'

    await releaseNipIoApex()
    const tenant = await createTestTenant(`E2E Share ${w} ${stamp}`, slug, canonicalHost)
    const imageId = await createPageImage(tenant.id, mediaUrl)
    await createTestPage(tenant.id, 'kids', 'Kids', { meta: { image: imageId } })

    const response = await openServedPage(page, canonicalHost, '/kids')
    expect(response?.status()).toBe(200)

    const indexedUrl = `https://${canonicalHost}/kids`
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', mediaUrl)
    await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1)
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', mediaUrl)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', indexedUrl)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', indexedUrl)
  })

  test('an absolute media URL on the platform origin keeps that host', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const nipIoAvailable = await isNipIoDnsAvailable()
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    const canonicalHost = `e2e-share-origin-${w}-${stamp}.127.0.0.1.nip.io`
    const slug = `shareorigin-${w}-${stamp}`
    const fileName = `origin-${stamp}.png`
    const shareImage = `http://localhost:${port}/api/media/file/${fileName}`

    await releaseNipIoApex()
    const tenant = await createTestTenant(`E2E Share Origin ${w} ${stamp}`, slug, canonicalHost)
    const imageId = await createPathImage(tenant.id, fileName)
    await createTestPage(tenant.id, 'kids', 'Kids', { meta: { image: imageId } })

    const response = await openServedPage(page, canonicalHost, '/kids')
    expect(response?.status()).toBe(200)

    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', shareImage)
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', shareImage)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      `https://${canonicalHost}/kids`,
    )
  })

  test('a media path is a share image on the canonical host with no port', async ({
    page,
    testData,
  }) => {
    test.setTimeout(90_000)
    const nipIoAvailable = await isNipIoDnsAvailable()
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    const canonicalHost = `e2e-share-path-${w}-${stamp}.127.0.0.1.nip.io`
    const slug = `sharepath-${w}-${stamp}`
    const fileName = `kids-photo-${stamp}.png`
    const shareImage = `https://${canonicalHost}/api/media/file/${fileName}`

    await releaseNipIoApex()
    const tenant = await createTestTenant(`E2E Share Path ${w} ${stamp}`, slug, canonicalHost)
    const imageId = await createPathImage(tenant.id, fileName)
    await storeMediaFileUrl(imageId, `api/media/file/${fileName}`)
    await createTestPage(tenant.id, 'kids', 'Kids', { meta: { image: imageId } })

    const response = await openServedPage(page, canonicalHost, '/kids')
    expect(response?.status()).toBe(200)

    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', shareImage)
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', shareImage)
  })

  test('a page with no image emits no share image even when the tenant has a logo', async ({
    page,
    testData,
  }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `sharelogo-${w}-${stamp}`
    const host = `${slug}.localhost`

    const tenant = await createTestTenant(`E2E Share Logo ${w} ${stamp}`, slug)
    const logoId = await createPathImage(tenant.id, `logo-${stamp}.png`)
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { logo: logoId },
      overrideAccess: true,
    })
    await createTestPage(tenant.id, 'plain', 'Plain')

    const response = await openServedPage(page, host, '/plain')
    expect(response?.status()).toBe(200)
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0)
    await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(0)
    await expect(page.locator('link[rel="icon"]')).toHaveCount(1)
  })

  test('a media path uses the platform subdomain when no custom canonical host is named', async ({
    page,
    testData,
  }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `shareplat-${w}-${stamp}`
    const host = `${slug}.localhost`
    const fileName = `plat-${stamp}.png`
    const shareImage = `https://${host}/api/media/file/${fileName}`

    const tenant = await createTestTenant(`E2E Share Platform ${w} ${stamp}`, slug)
    const imageId = await createPathImage(tenant.id, fileName)
    await storeMediaFileUrl(imageId, `api/media/file/${fileName}`)
    await createTestPage(tenant.id, 'kids', 'Kids', { meta: { image: imageId } })

    const response = await openServedPage(page, host, '/kids')
    expect(response?.status()).toBe(200)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', shareImage)
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', shareImage)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      `https://${host}/kids`,
    )
  })

  test('the homepage uses the same share image as a page', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `sharehome-${w}-${stamp}`
    const host = `${slug}.localhost`
    const fileName = `home-${stamp}.png`
    const shareImage = `https://${host}/api/media/file/${fileName}`

    const tenant = await createTestTenant(`E2E Share Home ${w} ${stamp}`, slug)
    const imageId = await createPathImage(tenant.id, fileName)
    await storeMediaFileUrl(imageId, `api/media/file/${fileName}`)
    const payload = await getPayloadInstance()
    const home = await payload.find({
      collection: 'pages',
      where: { and: [{ slug: { equals: 'home' } }, { tenant: { equals: tenant.id } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const homePage = home.docs[0]
    if (!homePage) throw new Error('expected the tenant home page')
    await payload.update({
      collection: 'pages',
      id: homePage.id,
      data: { meta: { image: imageId } },
      overrideAccess: true,
    })

    const response = await openServedPage(page, host, '/')
    expect(response?.status()).toBe(200)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', shareImage)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `https://${host}`)
  })

  test('a post uses the same share image as a page', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `sharepost-${w}-${stamp}`
    const host = `${slug}.localhost`
    const fileName = `post-${stamp}.png`
    const shareImage = `https://${host}/api/media/file/${fileName}`

    const tenant = await createTestTenant(`E2E Share Post ${w} ${stamp}`, slug)
    const imageId = await createPathImage(tenant.id, fileName)
    await storeMediaFileUrl(imageId, `api/media/file/${fileName}`)
    const payload = await getPayloadInstance()
    await payload.create({
      collection: 'posts',
      data: {
        title: 'Open mat',
        slug: 'open-mat',
        tenant: tenant.id,
        _status: 'published',
        meta: { image: imageId },
        content: {
          root: {
            type: 'root',
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr',
            children: [
              {
                type: 'paragraph',
                format: '',
                indent: 0,
                version: 1,
                direction: 'ltr',
                children: [
                  {
                    type: 'text',
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'Open mat',
                    version: 1,
                  },
                ],
              },
            ],
          },
        },
      },
      draft: false,
      overrideAccess: true,
    })

    const response = await openServedPage(page, host, '/posts/open-mat')
    expect(response?.status()).toBe(200)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', shareImage)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      `https://${host}/posts/open-mat`,
    )
  })

  test('a query on a media path stays on the share image', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `sharequery-${w}-${stamp}`
    const host = `${slug}.localhost`
    const shareImage = `https://${host}/api/media/file/photo.jpg?v=2`

    const tenant = await createTestTenant(`E2E Share Query ${w} ${stamp}`, slug)
    const imageId = await createPathImage(tenant.id, `query-${stamp}.png`)
    await storeMediaFileUrl(imageId, 'api/media/file/photo.jpg?v=2')
    await createTestPage(tenant.id, 'kids', 'Kids', { meta: { image: imageId } })

    const response = await openServedPage(page, host, '/kids')
    expect(response?.status()).toBe(200)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', shareImage)
  })

  test('a share-sized URL is used when the file URL is different', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `shareog-${w}-${stamp}`
    const host = `${slug}.localhost`
    const shareImage = 'https://files.example.com/og/wide.jpg?v=1'

    const tenant = await createTestTenant(`E2E Share Sized ${w} ${stamp}`, slug)
    const imageId = await createPathImage(tenant.id, `full-${stamp}.png`)
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'media',
      id: imageId,
      data: {
        sizes: {
          og: {
            url: shareImage,
          },
        },
      },
      overrideAccess: true,
    })
    await createTestPage(tenant.id, 'kids', 'Kids', { meta: { image: imageId } })

    const response = await openServedPage(page, host, '/kids')
    expect(response?.status()).toBe(200)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', shareImage)
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', shareImage)
  })

  test('a share-sized path is a share image on the canonical host', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `shareogpath-${w}-${stamp}`
    const host = `${slug}.localhost`
    const shareImage = `https://${host}/og/wide.jpg`

    const tenant = await createTestTenant(`E2E Share Sized Path ${w} ${stamp}`, slug)
    const imageId = await createPathImage(tenant.id, `full-${stamp}.png`)
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'media',
      id: imageId,
      data: {
        url: 'https://files.example.com/full.jpg',
        sizes: {
          og: {
            url: 'og/wide.jpg',
          },
        },
      },
      overrideAccess: true,
    })
    await createTestPage(tenant.id, 'kids', 'Kids', { meta: { image: imageId } })

    const response = await openServedPage(page, host, '/kids')
    expect(response?.status()).toBe(200)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', shareImage)
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', shareImage)
  })

  test('a file URL is the share image when no share-sized URL exists', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `sharefile-${w}-${stamp}`
    const host = `${slug}.localhost`
    const shareImage = 'https://files.example.com/share/full.jpg?v=3'

    const tenant = await createTestTenant(`E2E Share File ${w} ${stamp}`, slug)
    const imageId = await createPathImage(tenant.id, `full-${stamp}.png`)
    await storeMediaFileUrl(imageId, shareImage)
    await createTestPage(tenant.id, 'kids', 'Kids', { meta: { image: imageId } })

    const response = await openServedPage(page, host, '/kids')
    expect(response?.status()).toBe(200)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', shareImage)
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', shareImage)
  })
})
