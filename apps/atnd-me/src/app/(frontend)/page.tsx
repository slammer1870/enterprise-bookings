import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import { draftMode } from 'next/headers'
import type { RequiredDataFromCollectionSlug } from 'payload'
import PageClient from './[slug]/page.client'
import { LivePreviewListener } from '@/components/LivePreviewListener'

/**
 * Root page handler for both marketing (no subdomain) and tenant home pages
 * 
 * Flow:
 * - If tenant subdomain detected: Redirect to /home (tenant-specific)
 * - If no subdomain: Try to load a page with slug "root" (editable in admin, no tenant)
 * - Fallback: Show default marketing content
 */
export default async function RootPage() {
  const { isEnabled: draft } = await draftMode()
  const cookieStore = await cookies()
  const tenantSlug = cookieStore.get('tenant-slug')?.value
  
  // If tenant context exists, validate tenant exists before redirecting
  if (tenantSlug) {
    const payload = await getPayload({ config })
    
    // Validate that the tenant exists
    try {
      const tenantResult = await payload.find({
        collection: 'tenants',
        where: {
          slug: {
            equals: tenantSlug,
          },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      
      // If tenant doesn't exist, show 404
      if (!tenantResult.docs[0]) {
        const { notFound } = await import('next/navigation')
        notFound()
      }
    } catch (error) {
      // If lookup fails, show 404
      console.error('Error validating tenant:', error)
      const { notFound } = await import('next/navigation')
      notFound()
    }
    
    // Tenant exists, redirect to home page
    redirect('/home')
  }

  // For root domain (no subdomain), try to load an editable landing page
  // Look for a page with slug "root" with no tenant (global marketing page)
  const payload = await getPayload({ config })
  
  // Try to find a root page (slug "root" with no tenant)
  // Use overrideAccess to bypass tenant filtering for root domain pages
  let page: RequiredDataFromCollectionSlug<'pages'> | null = null
  
  try {
    const rootPages = await payload.find({
      collection: 'pages',
      where: {
        slug: {
          equals: 'root',
        },
        // For root domain pages, tenant should be null/undefined
        // We query without tenant filter and check if tenant is null
      },
      draft,
      depth: 2,
      limit: 10, // Get multiple to filter by null tenant
      pagination: false,
      overrideAccess: true, // Bypass access control to find root pages
    })

    // Filter to find pages with no tenant (null tenant field)
    page = rootPages.docs.find((doc: any) => !doc.tenant || doc.tenant === null) || null
  } catch (error) {
    // If query fails, continue with fallback
    console.error('Error loading root page:', error)
  }

  // If no editable page found, use fallback static content
  if (!page) {
    // Return the default marketing page structure
    // To make this editable: Create a page with slug "root" and leave tenant field empty (admin can do this)
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6 text-gray-900">
              Welcome to ATND ME
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              A powerful multi-tenant booking platform for fitness studios, yoga centers, and wellness businesses.
            </p>
            <p className="text-lg text-gray-500 mb-12">
              Manage your classes, instructors, and bookings all in one place. Choose from our available tenants below to get started.
            </p>
            
            <div className="mb-12">
              <Link
                href="/tenants"
                className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                View All Tenants
              </Link>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mt-16">
              <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold mb-4">Easy Booking</h2>
                <p className="text-gray-600">
                  Simple and intuitive booking system for your customers. Book classes in just a few clicks.
                </p>
              </div>
              <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold mb-4">Multi-Tenant</h2>
                <p className="text-gray-600">
                  Each tenant has their own isolated space with custom branding, pages, and settings.
                </p>
              </div>
              <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold mb-4">Flexible Management</h2>
                <p className="text-gray-600">
                  Manage instructors, class options, schedules, and bookings all from one admin panel.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render the editable page from admin
  const { hero, layout } = page

  return (
    <article>
      <PageClient />
      <PayloadRedirects disableNotFound url="/" />
      {draft && <LivePreviewListener />}
      <RenderHero {...hero} />
      <RenderBlocks blocks={layout} />
    </article>
  )
}
