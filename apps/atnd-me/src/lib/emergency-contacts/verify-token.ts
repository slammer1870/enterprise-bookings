import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

export type EmergencyContactVerifyPayload = {
  userId: number
  tenantId: number
  email: string
  exp: number
  nonce: string
}

function getSecret(): string {
  const configuredSecret = process.env.PAYLOAD_SECRET?.trim()
  if (configuredSecret) return configuredSecret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PAYLOAD_SECRET must be configured in production')
  }
  return process.env.CI || process.env.NODE_ENV === 'test'
    ? 'test-secret-key-for-ci-builds-only'
    : 'dev-secret-key'
}

export function buildEmergencyContactVerifyToken(
  userId: number,
  tenantId: number,
  email: string,
  exp: number = Date.now() + TOKEN_TTL_MS,
): string {
  const nonce = randomBytes(8).toString('hex')
  const payload: EmergencyContactVerifyPayload = {
    userId,
    tenantId,
    email: email.trim().toLowerCase(),
    exp,
    nonce,
  }
  const json = JSON.stringify(payload)
  const signature = createHmac('sha256', getSecret()).update(json).digest('base64url')
  return Buffer.from(json, 'utf8').toString('base64url') + '.' + signature
}

export function verifyEmergencyContactToken(token: string): EmergencyContactVerifyPayload {
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid verification token')
  }
  const [b64, sig] = parts
  const decoded = Buffer.from(b64, 'base64url').toString('utf8')
  const expectedSig = createHmac('sha256', getSecret()).update(decoded).digest('base64url')

  const a = new Uint8Array(Buffer.from(sig))
  const b = new Uint8Array(Buffer.from(expectedSig))
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid verification token signature')
  }

  const payload = JSON.parse(decoded) as EmergencyContactVerifyPayload
  if (payload.exp < Date.now()) {
    throw new Error('Verification token expired')
  }
  if (
    typeof payload.userId !== 'number' ||
    typeof payload.tenantId !== 'number' ||
    typeof payload.email !== 'string'
  ) {
    throw new Error('Invalid verification token payload')
  }
  return payload
}

export { TOKEN_TTL_MS as EMERGENCY_CONTACT_TOKEN_TTL_MS }
