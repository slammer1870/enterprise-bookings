import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getPayload } from '@/lib/payload'
import { getLocationContext } from '@/utilities/getLocationContext'
import { getTenantWithBranding } from '@/utilities/getTenantContext'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ branchSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branchSlug } = await params
  const payload = await getPayload()
  const cookieStore = await cookies()
  const headersList = await headers()
  const tenant = await getTenantWithBranding(payload, { cookies: cookieStore, headers: headersList })
  if (!tenant) return { title: 'Location' }

  const pathname = `/locations/${branchSlug}`
  const location = await getLocationContext(payload, {
    tenantId: tenant.id,
    source: { pathname, cookies: cookieStore },
  })
  return {
    title: location ? `${location.name} — ${tenant.name}` : 'Location',
  }
}

/**
 * Public branch landing: confirms `/locations/{slug}` exists for this tenant and shows a minimal hub.
 * Middleware sets the `branch-slug` cookie so schedule APIs can resolve branch context (Chunk 8).
 */
export default async function LocationBranchLandingPage({ params }: Props) {
  const { branchSlug } = await params
  const payload = await getPayload()
  const cookieStore = await cookies()
  const headersList = await headers()
  const tenant = await getTenantWithBranding(payload, { cookies: cookieStore, headers: headersList })
  if (!tenant) notFound()

  const pathname = `/locations/${branchSlug}`
  const location = await getLocationContext(payload, {
    tenantId: tenant.id,
    source: { pathname, cookies: cookieStore },
  })
  if (!location) notFound()

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{location.name}</h1>
      <p className="mt-2 text-muted-foreground">
        This site is set for scheduling and booking. Use the navigation above to browse classes or return home.
      </p>
      <p className="mt-6">
        <Link href="/" className="text-primary underline-offset-4 hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  )
}
