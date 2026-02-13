import type { Metadata } from 'next'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import { getPayload } from '@/lib/payload'
import type { RequiredDataFromCollectionSlug, Where } from 'payload'
import { draftMode } from 'next/headers'
import React from 'react'
import { homeStatic } from '@/endpoints/seed/home-static'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { generateMeta } from '@/utilities/generateMeta'
import { getTenantSlug, getTenantContext, getTenantWithBranding } from '@/utilities/getTenantContext'
import PageClient from './page.client'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { queryPageBySlug } from './queryPageBySlug'

export async function generateStaticParams() {
  try {
    const payload = await getPayload()
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
  
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const tenantSlug = await getTenantSlug({ cookies: cookieStore })
  if (tenantSlug) {
    const payload = await getPayload()
    const tenant = await getTenantContext(payload, { cookies: cookieStore })
    if (!tenant) {
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

  const { layout } = page

  return (
    <article>
      <PageClient />
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

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

  const payload = await getPayload()
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const tenantBranding = await getTenantWithBranding(payload, { cookies: cookieStore })

  return generateMeta({ doc: page, tenantBranding })
}
