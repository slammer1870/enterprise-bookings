/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { Metadata } from 'next'

import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap'
import { cookies } from 'next/headers'
import { getPayload } from '@/lib/payload'
import { getTenantWithBranding } from '@/utilities/getTenantContext'

type Args = {
  params: Promise<{
    segments: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

export const generateMetadata = async ({ params, searchParams }: Args): Promise<Metadata> => {
  // Start with Payload's default metadata, then whitelist/override dashboard head metadata.
  // This lets tenant branding apply while keeping Payload internals intact.
  const base = await generatePageMetadata({ config, params, searchParams })

  try {
    const cookieStore = await cookies()
    const payload = await getPayload()
    const tenant = await getTenantWithBranding(payload, { cookies: cookieStore })

    const fallbackName = 'ATND ME'
    const siteName = tenant?.name?.trim() || fallbackName
    const description =
      tenant?.description?.trim() ||
      // Keep a stable description fallback for cases where tenant branding isn't available.
      'ATND — bookings and websites for modern venues.'

    const logoUrl =
      tenant?.logo && typeof tenant.logo === 'object' && tenant.logo !== null
        ? typeof tenant.logo.url === 'string'
          ? tenant.logo.url
          : null
        : null

    return {
      ...base,
      title: {
        // Payload tends to produce "Dashboard - Payload | {Tenant}", so we replace just the base.
        default: `Dashboard - ${siteName}`,
        template: `%s | ${siteName}`,
      },
      description,
      icons: logoUrl
        ? {
            icon: logoUrl,
            shortcut: logoUrl,
            apple: logoUrl,
          }
        : {
            icon: '/favicon.ico',
            shortcut: '/favicon.ico',
            apple: '/favicon.ico',
          },
      openGraph: base.openGraph
        ? {
            ...base.openGraph,
            title: `Dashboard - ${siteName}`,
            description,
          }
        : undefined,
    }
  } catch {
    return base
  }
}

const Page = ({ params, searchParams }: Args) =>
  RootPage({ config, params, searchParams, importMap })

export default Page
