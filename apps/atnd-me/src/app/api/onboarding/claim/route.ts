import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import { claimTenant } from '@/lib/onboarding/claimTenant'
import { checkRateLimit } from '@/lib/onboarding/rateLimit'

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''
  const ip = clientIp(request)

  const ipLimit = checkRateLimit({ key: `claim:ip:${ip}`, limit: 10, windowMs: 60 * 60 * 1000 })
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000) || 60) },
      },
    )
  }

  if (email) {
    const emailLimit = checkRateLimit({
      key: `claim:email:${email}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests for this email. Try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(emailLimit.retryAfterMs / 1000) || 60) },
        },
      )
    }
  }

  const payload = await getPayload()

  const result = await claimTenant({
    payload,
    headers: request.headers,
    input: {
      slug: typeof raw.slug === 'string' ? raw.slug : '',
      tenantName: typeof raw.tenantName === 'string' ? raw.tenantName : '',
      name: typeof raw.name === 'string' ? raw.name : '',
      email,
    },
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status },
    )
  }

  return NextResponse.json({ ok: true })
}
