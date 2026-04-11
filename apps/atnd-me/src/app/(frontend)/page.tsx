import { getPayload } from '@/lib/payload'
import { cookies, headers } from 'next/headers'
import { RenderBlocks } from '@/blocks/RenderBlocks'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import { draftMode } from 'next/headers'
import type { Metadata } from 'next'
import type { RequiredDataFromCollectionSlug } from 'payload'
import type { Page } from '@/payload-types'
import PageClient from './[slug]/page.client'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { queryPageBySlug } from './[slug]/queryPageBySlug'
import { generateMeta } from '@/utilities/generateMeta'
import { getTenantWithBranding } from '@/utilities/getTenantContext'

/**
 * Root page handler for both marketing (no subdomain) and tenant home pages
 *
 * Flow:
 * - If tenant subdomain detected: Render the slug "home" page at / (no redirect)
 * - If no subdomain: Try to load a page with slug "root" (editable in admin, no tenant)
 * - Fallback: Show default marketing content
 */
export default async function RootPage() {
  const { isEnabled: draft } = await draftMode()
  const cookieStore = await cookies()
  const headersList = await headers()
  const payload = await getPayload()
  const tenant = await getTenantWithBranding(payload, { cookies: cookieStore, headers: headersList })
  const tenantSlug = tenant?.slug ?? null

  // If tenant context exists, render the home page at / instead of redirecting
  if (tenantSlug) {
    // Render the tenant's home page (slug "home") at /
    const page = await queryPageBySlug({ slug: 'home' })
    if (page) {
      const { layout } = page
      return (
        <article>
          <PageClient />
          <PayloadRedirects disableNotFound url="/" />
          {draft && <LivePreviewListener />}
          <RenderBlocks blocks={layout} />
        </article>
      )
    }
    // No home page found, let PayloadRedirects handle (redirects or 404)
    return <PayloadRedirects url="/home" />
  }

  // For root domain (no subdomain), try to load an editable landing page
  // Look for a page with slug "root" with no tenant (global marketing page)
  // Try to find a root page (slug "root" with no tenant)
  // Use overrideAccess to bypass tenant filtering for root domain pages
  let page: RequiredDataFromCollectionSlug<'pages'> | null = null
  
  try {
    const rootPages = await payload.find({
      collection: 'pages',
      where: {
        and: [
          { slug: { equals: 'root' } },
          // Root marketing pages are explicitly unscoped (tenant = null).
          { tenant: { equals: null } },
        ],
      },
      draft,
      depth: 2,
      limit: 1,
      overrideAccess: true, // Bypass access control to find root pages
    })

    page = (rootPages.docs[0] as Page | undefined) ?? null
  } catch (error) {
    // If query fails, continue with fallback
    console.error('Error loading root page:', error)
  }

  // If no editable page found, use fallback static content
  if (!page) {
    // Return the default marketing page structure
    // To make this editable: Create a page with slug "root" and leave tenant field empty (admin can do this)
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6">
              Welcome to ATND ME
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              A powerful multi-tenant booking platform for fitness studios, yoga centers, and wellness businesses.
            </p>
            <p className="text-lg text-muted-foreground/80 mb-12">
              Manage your classes, staffMembers, and bookings all in one place.
            </p>

            <div className="grid md:grid-cols-3 gap-8 mt-16">
              <div className="p-6 bg-card text-card-foreground rounded-lg border border-border shadow-sm">
                <h2 className="text-2xl font-semibold mb-4">Easy Booking</h2>
                <p className="text-muted-foreground">
                  Simple and intuitive booking system for your customers. Book classes in just a few clicks.
                </p>
              </div>
              <div className="p-6 bg-card text-card-foreground rounded-lg border border-border shadow-sm">
                <h2 className="text-2xl font-semibold mb-4">Multi-Tenant</h2>
                <p className="text-muted-foreground">
                  Each tenant has their own isolated space with custom branding, pages, and settings.
                </p>
              </div>
              <div className="p-6 bg-card text-card-foreground rounded-lg border border-border shadow-sm">
                <h2 className="text-2xl font-semibold mb-4">Flexible Management</h2>
                <p className="text-muted-foreground">
                  Manage staffMembers, class options, schedules, and bookings all from one admin panel.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render the editable page from admin
  const { layout } = page

  return (
    <article>
      <PageClient />
      <PayloadRedirects disableNotFound url="/" />
      {draft && <LivePreviewListener />}
      <RenderBlocks blocks={layout} />
    </article>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const headersList = await headers()
  const payload = await getPayload()
  const tenantBranding = await getTenantWithBranding(payload, { cookies: cookieStore, headers: headersList })

  if (tenantBranding?.slug) {
    const homePage = await queryPageBySlug({ slug: 'home' })
    if (homePage) {
      return generateMeta({
        doc: homePage,
        tenantBranding,
        pathname: '/',
      })
    }

    return generateMeta({
      doc: null,
      tenantBranding,
      pathname: '/',
    })
  }

  let rootPage: RequiredDataFromCollectionSlug<'pages'> | null = null

  try {
    const rootPages = await payload.find({
      collection: 'pages',
      where: {
        and: [{ slug: { equals: 'root' } }, { tenant: { equals: null } }],
      },
      draft: false,
      depth: 2,
      limit: 1,
      overrideAccess: true,
    })

    rootPage = (rootPages.docs[0] as Page | undefined) ?? null
  } catch {
    rootPage = null
  }

  return generateMeta({
    doc: rootPage,
    tenantBranding: null,
    pathname: '/',
  })
}
