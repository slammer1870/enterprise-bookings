import { createHmac, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  E2E_START_WEBHOOK_SECRET,
  resolveE2EStripeWebhookSecret,
} from '../e2e/helpers/e2e-webhook-secret'

const packageJsonPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../package.json',
)

function signatureVerifies(body: string, signature: string, secret: string): boolean {
  const entries = Object.fromEntries(
    signature.split(',').map((part) => {
      const [k, v] = part.split('=')
      return [k?.trim(), v?.trim()]
    }),
  )
  const t = entries.t
  const v1 = entries.v1
  if (!t || !v1) return false
  const expected = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
  const received = Buffer.from(v1, 'hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  return (
    received.length === expectedBuf.length &&
    timingSafeEqual(new Uint8Array(received), new Uint8Array(expectedBuf))
  )
}

describe('resolveE2EStripeWebhookSecret', () => {
  it('signs production e2e with the start:e2e secret, not a developer .env secret', () => {
    const developerSecret = 'whsec_developer'
    const secret = resolveE2EStripeWebhookSecret({
      E2E_USE_PROD: 'true',
      STRIPE_CONNECT_WEBHOOK_SECRET: developerSecret,
      STRIPE_WEBHOOK_SECRET: 'whsec_1234567890',
    })
    const body = '{"id":"evt_e2e","type":"payment_intent.succeeded"}'
    const t = 1_700_000_000
    const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
    const signature = `t=${t},v1=${v1}`

    expect(secret).toBe(E2E_START_WEBHOOK_SECRET)
    expect(signatureVerifies(body, signature, E2E_START_WEBHOOK_SECRET)).toBe(true)
    expect(signatureVerifies(body, signature, developerSecret)).toBe(false)
    expect(signatureVerifies(body, signature, 'whsec_1234567890')).toBe(false)
  })

  it('uses the start:e2e secret when E2E_USE_PROD is unset', () => {
    expect(
      resolveE2EStripeWebhookSecret({
        STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_developer',
      }),
    ).toBe(E2E_START_WEBHOOK_SECRET)
  })

  it('keeps the developer secret for next dev e2e', () => {
    expect(
      resolveE2EStripeWebhookSecret({
        E2E_USE_PROD: 'false',
        STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_developer',
        STRIPE_WEBHOOK_SECRET: 'whsec_platform',
      }),
    ).toBe('whsec_developer')
  })

  it('matches the secret pinned by pnpm start:e2e', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      scripts: { 'start:e2e': string }
    }
    expect(pkg.scripts['start:e2e']).toContain(
      `STRIPE_CONNECT_WEBHOOK_SECRET=${E2E_START_WEBHOOK_SECRET}`,
    )
  })
})
