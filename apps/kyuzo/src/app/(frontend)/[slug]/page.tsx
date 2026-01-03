import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPayload, CollectionSlug } from 'payload'

import config from '@payload-config'

import type { Page } from '@repo/shared-types'

import { RenderBlocks } from '@/blocks/render-blocks'

import { generateMetadataFunction } from '@repo/website/src/utils/generate-metadata'

// Force dynamic rendering to prevent Next.js caching and ensure fresh page lookups
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const payload = await getPayload({ config })
  return generateMetadataFunction({ params: paramsPromise, payload })
}

export async function generateStaticParams() {
  const payload = await getPayload({ config })
  const pagesQuery = await payload.find({
    collection: 'pages' as CollectionSlug,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    select: {
      slug: true,
    },
  })

  const pages = pagesQuery.docs as unknown as Page[]

  const params = pages
    ?.filter((doc) => {
      return doc.slug !== 'home'
    })
    .map(({ slug }) => {
      return { slug }
    })

  return params
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const payload = await getPayload({ config })

  const { slug = 'home' } = await paramsPromise

  //let page: RequiredDataFromCollectionSlug<'pages'> | nulls

  const result = await payload.find({
    collection: 'pages',
    limit: 1,
    pagination: false,
    // This route is the public website. Some environments can evaluate the local Payload API
    // without a request-bound user/context; `overrideAccess: true` avoids intermittent empty results.
    // Pages themselves are public (see collection access), so this does not widen exposure in practice.
    overrideAccess: true,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  const page = result.docs?.[0] || null

  if (!page) {
    return notFound()
  }

  const layout = { page }

  return (
    <article>
      <RenderBlocks blocks={layout.page.layout} />
    </article>
  )
}
