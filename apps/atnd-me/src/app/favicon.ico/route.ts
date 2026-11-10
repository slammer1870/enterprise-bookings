import { readFile } from 'node:fs/promises'

import { headers } from 'next/headers'

import { getPayload } from '@/lib/payload'
import {
  absoluteLogoUrl,
  logoFileUrl,
  requestOrigin,
  tenantFaviconPng,
} from '@/lib/seo/tenantFavicon'
import { getTenantWithBranding } from '@/utilities/getTenantContext'
import { getServerSideURL } from '@/utilities/getURL'
import { isPlatformPublicHostname } from '@/utilities/publicHostOutcome'
import { getRequestHostname } from '@/utilities/tenantRequest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const platformIcoUrl = new URL('../../assets/platform-favicon.ico', import.meta.url)

let platformIco: Buffer | null = null

function iconResponse(body: Buffer, contentType: string): Response {
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
      'x-content-type-options': 'nosniff',
    },
  })
}

function empty(status: number): Response {
  return new Response(null, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

async function platformFavicon(): Promise<Response> {
  if (!platformIco) platformIco = await readFile(platformIcoUrl)
  return iconResponse(platformIco, 'image/x-icon')
}

/**
 * Google Search fetches `/favicon.ico` on the page's host and will not use an
 * icon under `/api/` (disallowed in robots.txt) or a size that is not a multiple
 * of 48px. Serve the tenant logo from this stable same-origin URL.
 * Cookies are ignored so a shared platform-domain cookie cannot swap icons.
 */
export async function GET(): Promise<Response> {
  const headersList = await headers()
  const hostname = getRequestHostname(headersList)
  if (!hostname) return empty(404)
  if (isPlatformPublicHostname(hostname)) return platformFavicon()

  try {
    const hostHeaders = new Headers(headersList)
    hostHeaders.delete('cookie')
    const payload = await getPayload()
    const tenant = await getTenantWithBranding(payload, { headers: hostHeaders })
    const stored = logoFileUrl(tenant?.logo)
    const logoUrl = stored
      ? absoluteLogoUrl(stored, requestOrigin(hostHeaders, getServerSideURL()))
      : null
    if (!logoUrl) return empty(404)
    const png = await tenantFaviconPng(logoUrl)
    return iconResponse(png, 'image/png')
  } catch (error) {
    console.error('Unable to build tenant favicon:', error)
    return empty(404)
  }
}
