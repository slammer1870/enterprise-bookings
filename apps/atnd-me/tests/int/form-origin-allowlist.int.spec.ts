/**
 * A form posted from a named hostname is allowed. An unnamed hostname is refused.
 * A row that still has only the custom domain and the alias list allows the custom domain.
 *
 * Run with: pnpm test:int -- form-origin-allowlist
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { POST } from '@/app/api/form-submissions/route'

const TEST_TIMEOUT = 60_000
const HOOK_TIMEOUT = 300_000

vi.mock('@/lib/cloudflare/customHostnames', () => ({
  createOrGetCustomHostname: vi.fn().mockResolvedValue({
    id: 'csh_test',
    verificationTxtValue: 'txt-token-mock',
    status: 'pending',
  }),
}))

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => ({
    paymentMethodDomains: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      create: vi.fn().mockResolvedValue({ id: 'pmd_mock', enabled: true }),
      update: vi.fn().mockResolvedValue({ id: 'pmd_mock', enabled: true }),
    },
  }),
}))

const stamp = Date.now()

async function postForm(origin: string): Promise<Response> {
  return POST(
    new Request('https://atnd.me/api/form-submissions', {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    }),
  )
}

describe('Form origin allowlist', () => {
  let payload: Payload
  const tenantIds: Array<number | string> = []

  const registrable = `form-allow-${stamp}.com`
  const apex = registrable
  const www = `www.${registrable}`
  const aliasRegistrable = `form-alias-${stamp}.com`
  const aliasApex = aliasRegistrable
  const aliasWww = `www.${aliasRegistrable}`
  const legacyRegistrable = `form-legacy-${stamp}.com`
  const legacyDomain = legacyRegistrable
  const legacyAlias = `www.${legacyRegistrable}`

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    const serving = await payload.create({
      collection: 'tenants',
      data: {
        name: `Form allow ${stamp}`,
        slug: `form-allow-${stamp}`,
        hostnames: [www, apex],
        direction: 'allow-www-and-non-www',
      },
      overrideAccess: true,
    })
    const alias = await payload.create({
      collection: 'tenants',
      data: {
        name: `Form alias ${stamp}`,
        slug: `form-alias-${stamp}`,
        hostnames: [aliasWww, aliasApex],
        direction: 'redirect-to-www',
      },
      overrideAccess: true,
    })
    const legacy = await payload.create({
      collection: 'tenants',
      data: {
        name: `Form legacy ${stamp}`,
        slug: `form-legacy-${stamp}`,
        domain: legacyDomain,
        aliasHosts: [legacyAlias],
      },
      overrideAccess: true,
    })
    tenantIds.push(serving.id, alias.id, legacy.id)
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    try {
      if (!payload) return
      for (const id of tenantIds) {
        await payload.delete({
          collection: 'tenants',
          where: { id: { equals: id } },
          overrideAccess: true,
        })
      }
      await payload.db?.destroy?.()
    } catch {
      // ignore cleanup errors
    }
  }, TEST_TIMEOUT)

  async function expectAllowed(origin: string) {
    const response = await postForm(origin)
    expect(response.status).toBe(400)
    expect(response.headers.get('access-control-allow-origin')).toBe(origin)
  }

  it('allows a form posted from a serving host that is not the canonical host', async () => {
    await expectAllowed(`https://${www}`)
  }, TEST_TIMEOUT)

  it('allows a form posted from an alias host in the hostname list', async () => {
    await expectAllowed(`https://${aliasApex}`)
  }, TEST_TIMEOUT)

  it('refuses a form posted from a hostname the tenant has not named', async () => {
    const response = await postForm(`https://unnamed-${stamp}.com`)
    expect(response.status).toBe(403)
  }, TEST_TIMEOUT)

  it('still allows the custom domain on a row that has not saved a hostname list', async () => {
    await expectAllowed(`https://${legacyDomain}`)
  }, TEST_TIMEOUT)

  it('still refuses an alias on a row that has not saved a hostname list', async () => {
    const response = await postForm(`https://${legacyAlias}`)
    expect(response.status).toBe(403)
  }, TEST_TIMEOUT)
})
