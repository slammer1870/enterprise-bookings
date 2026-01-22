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

    const params = pages.docs
      ?.filter((doc) => {
        return doc.slug !== 'home'
      })
      .map(({ slug }) => {
        return { slug }
      })

    return params || []
  } catch (error) {
    // During build, database may not be available - return empty array
    console.warn('generateStaticParams for pages failed:', error instanceof Error ? error.message : String(error))
    return []
  }
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  try {
    const { isEnabled: draft } = await draftMode()
    const { slug = 'home' } = await paramsPromise
    // Decode to support slugs with special characters
    const decodedSlug = decodeURIComponent(slug)
    const url = '/' + decodedSlug
    let page: RequiredDataFromCollectionSlug<'pages'> | null

    page = await queryPageBySlug({
      slug: decodedSlug,
    })

    // Remove this code once your website is seeded
    if (!page && slug === 'home') {
      page = homeStatic
    }

    if (!page) {
      return <PayloadRedirects url={url} />
    }

    const { hero, layout } = page

    return (
      <article className="pt-16 pb-24">
        <PageClient />
        {/* Allows redirects for valid pages too */}
        <PayloadRedirects disableNotFound url={url} />

        {draft && <LivePreviewListener />}

        <RenderHero {...hero} />
        <RenderBlocks blocks={layout} />
      </article>
    )
  } catch (error) {
    // During build, database may not be available - return redirect component
    const { slug = 'home' } = await paramsPromise
    const decodedSlug = decodeURIComponent(slug)
    const url = '/' + decodedSlug
    console.warn('Page component failed:', error instanceof Error ? error.message : String(error))
    return <PayloadRedirects url={url} />
  }
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  try {
    const { slug = 'home' } = await paramsPromise
    // Decode to support slugs with special characters
    const decodedSlug = decodeURIComponent(slug)
    const page = await queryPageBySlug({
      slug: decodedSlug,
    })

    return generateMeta({ doc: page })
  } catch (error) {
    // During build, database may not be available - return default metadata
    console.warn('generateMetadata failed:', error instanceof Error ? error.message : String(error))
    return generateMeta({ doc: null })
  }
}

const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  try {
    const { isEnabled: draft } = await draftMode()

    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'pages',
      draft,
      limit: 1,
      pagination: false,
      overrideAccess: draft,
      where: {
        slug: {
          equals: slug,
        },
      },
    })

    return result.docs?.[0] || null
  } catch (error) {
    // During build, database may not be available - return null
    console.warn('queryPageBySlug failed:', error instanceof Error ? error.message : String(error))
    return null
  }
})
