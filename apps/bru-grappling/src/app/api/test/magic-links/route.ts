import { NextRequest, NextResponse } from 'next/server'

import {
  clearTestMagicLinks,
  getLatestTestMagicLink,
  isTestMagicLinkStoreEnabled,
} from '@repo/better-auth-config/server'

export const dynamic = 'force-dynamic'

function disabledResponse() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function GET(request: NextRequest) {
  if (!isTestMagicLinkStoreEnabled()) {
    return disabledResponse()
  }

  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }

  const latest = getLatestTestMagicLink(email)
  if (!latest) {
    return NextResponse.json({ error: 'Magic link not found' }, { status: 404 })
  }

  return NextResponse.json(latest)
}

export async function DELETE(request: NextRequest) {
  if (!isTestMagicLinkStoreEnabled()) {
    return disabledResponse()
  }

  const email = request.nextUrl.searchParams.get('email') ?? undefined
  clearTestMagicLinks(email ?? undefined)

  return NextResponse.json({ success: true, cleared: email ?? 'all' })
}

