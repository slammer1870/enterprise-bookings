import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// Mark this route as dynamic to avoid static generation issues with Payload GraphQL schema
export const dynamic = 'force-dynamic'

import { getPayload } from 'payload'

import config from '@/payload.config'

import { RenderBlocks } from '@/blocks/render-blocks'

import { generateMetadataFunction } from '@repo/website/src/utils/generate-metadata'

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const payload = await getPayload({ config })
  return generateMetadataFunction({ params: paramsPromise, payload })
}

export async function generateStaticParams() {
  try {
  const payload = await getPayload({ config })
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
    console.error('Error generating static params for pages:', error)
    // Return empty array on error to prevent build failure
    // Pages will be generated dynamically at runtime
    return []
  }
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
    overrideAccess: false,
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
