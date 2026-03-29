/**
 * Build Stripe Connect OAuth authorize URL and signed state (step 2.3).
 * State is HMAC-signed and bound to tenant + user + expiry.
 * verifyConnectState / buildConnectState support callback (step 2.4).
 */
import { createHmac } from 'node:crypto'
import { getStripeConnectEnv } from '@/lib/stripe/platform'

const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export type ConnectStatePayload = { tenantId: number; userId: number; exp: number; nonce: string }

/** Build state string for tests (e.g. expired state when exp is in the past). */
export function buildConnectState(
  tenantId: number,
  userId: number,
  exp: number = Date.now() + STATE_TTL_MS,
): string {
  const { webhookSecret } = getStripeConnectEnv()
  const nonce = createHmac('sha256', webhookSecret)
    .update(`${tenantId}:${userId}:${exp}:${Math.random()}`)
    .digest('hex')
    .slice(0, 16)
  const payload = JSON.stringify({ tenantId, userId, exp, nonce })
  const signature = createHmac('sha256', webhookSecret).update(payload).digest('base64url')
  return Buffer.from(payload, 'utf8').toString('base64url') + '.' + signature
}

/** Verify state signature and expiry; return tenantId and userId. */
export function verifyConnectState(state: string): { tenantId: number; userId: number } {
  const { webhookSecret } = getStripeConnectEnv()
  const parts = state.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid state format')
  }
  const [b64, sig] = parts
  const decoded = Buffer.from(b64, 'base64url').toString('utf8')
  const expectedSig = createHmac('sha256', webhookSecret).update(decoded).digest('base64url')
  if (sig !== expectedSig) {
    throw new Error('Invalid state signature')
  }
  const payload = JSON.parse(decoded) as ConnectStatePayload
  if (payload.exp < Date.now()) {
    throw new Error('State expired')
  }
  if (typeof payload.tenantId !== 'number' || typeof payload.userId !== 'number') {
    throw new Error('Invalid state: missing tenant or user binding')
  }
  return { tenantId: payload.tenantId, userId: payload.userId }
}

export function buildStripeConnectAuthorizeUrl(
  tenantId: number,
  userId: number,
  redirectBaseUrl: string,
): { url: string; state: string } {
  const { connectClientId } = getStripeConnectEnv()
  const exp = Date.now() + STATE_TTL_MS
  const state = buildConnectState(tenantId, userId, exp)

  const redirectUri = `${redirectBaseUrl.replace(/\/$/, '')}/api/stripe/connect/callback`
  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'read_write',
    client_id: connectClientId,
    redirect_uri: redirectUri,
    state,
  })
  const url = `https://connect.stripe.com/oauth/authorize?${params.toString()}`
  return { url, state }
}
