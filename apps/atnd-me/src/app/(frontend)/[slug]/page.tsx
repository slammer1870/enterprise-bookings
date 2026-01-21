import type { Metadata } from 'next'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'
import { draftMode } from 'next/headers'
import React, { cache } from 'react'
import { homeStatic } from '@/endpoints/seed/home-static'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { generateMeta } from '@/utilities/generateMeta'
import PageClient from './page.client'
import { LivePreviewListener } from '@/components/LivePreviewListener'

export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config: configPromise })
    const pages = await payload.find({
      collection: 'pages',
      draft: false,
      limit: 1000,
      overrideAccess: false,
      pagination: false,
      select: {
        slug: true,
      },
    })

    // Filter out 'home' slug and ensure all slugs are valid strings
    // Add null checks to prevent undefined errors
    if (!pages || !pages.docs || !Array.isArray(pages.docs)) {
      return []
    }
    
    const params = pages.docs
      .filter((doc) => {
        // Ensure doc exists, has a slug, and is a string, and is not 'home'
        return doc && doc.slug && typeof doc.slug === 'string' && doc.slug !== 'home'
      })
      .map((doc) => {
        // Ensure slug is a string
        const slug = typeof doc.slug === 'string' ? doc.slug : String(doc.slug || '')
        return { slug }
      })
      .filter((param) => param && param.slug) // Remove any empty slugs

    return params
  } catch (error) {
    // If there's an error, return empty array to prevent build failure
    console.error('Error generating static params:', error)
    return []
  }
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = 'home' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const url = '/' + decodedSlug
  
  // Check for tenant slug to validate tenant exists
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const tenantSlug = cookieStore.get('tenant-slug')?.value
  
  // If we have a tenant slug, validate the tenant exists before proceeding
  if (tenantSlug) {
    const payload = await getPayload({ config: configPromise })
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
      if (!tenantResult.docs || tenantResult.docs.length === 0) {
        const { notFound } = await import('next/navigation')
        notFound()
      }
    } catch (error) {
      // If lookup fails, show 404
      console.error('Error validating tenant:', error)
      const { notFound } = await import('next/navigation')
      notFound()
    }
  }
  
  let page: RequiredDataFromCollectionSlug<'pages'> | null

  page = await queryPageBySlug({
    slug: decodedSlug,
  })

  // Remove this code once your website is seeded
  // Only use homeStatic if there's no tenant context (root domain)
  if (!page && slug === 'home' && !tenantSlug) {
    page = homeStatic
  }

  if (!page) {
    return <PayloadRedirects url={url} />
  }

  const { hero, layout } = page

  return (
    <article>
      <PageClient />
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <RenderHero {...hero} />
      <RenderBlocks blocks={layout} />
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = 'home' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const page = await queryPageBySlug({
    slug: decodedSlug,
  })

  return generateMeta({ doc: page })
}

const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const tenantSlug = cookieStore.get('tenant-slug')?.value

  const payload = await getPayload({ config: configPromise })

  // Resolve tenant slug to tenant ID if subdomain is present
  let tenantId: string | number | null = null
  if (tenantSlug) {
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
      
      // If tenant doesn't exist, return null to trigger 404
      if (!tenantResult.docs[0]) {
        return null
      }
      
      tenantId = tenantResult.docs[0].id
    } catch (error) {
      // If tenant lookup fails, return null to trigger 404
      console.error('Error looking up tenant:', error)
      return null
    }
  }

  // Build where clause with tenant filter if tenant context exists
  const where: any = {
    slug: {
      equals: slug,
    },
  }

  // Add tenant filter if tenant context is set (from subdomain)
  if (tenantId) {
    where.tenant = {
      equals: tenantId,
    }
  }

  const result = await payload.find({
    collection: 'pages',
    draft,
    depth: 2, // Populate media relations and nested references
    limit: 1,
    pagination: false,
    overrideAccess: draft,
    where,
  })

  return result.docs?.[0] || null
})
