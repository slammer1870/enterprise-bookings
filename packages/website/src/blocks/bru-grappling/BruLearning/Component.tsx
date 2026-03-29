'use client'

import React from 'react'
import Image from 'next/image'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { RichText } from '@payloadcms/richtext-lexical/react'

type ImageLike =
  | {
      url?: string
      alt?: string
    }
  | number
  | string

function getImageUrl(image: ImageLike | undefined | null): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (typeof image === 'object' && image?.url) return image.url
  return null
}

function getImageAlt(image: ImageLike | undefined | null): string {
  if (!image) return ''
  if (typeof image === 'object') return image.alt || ''
  return ''
}

export const BruLearningBlock: React.FC<{
  title: string
  content: SerializedEditorState
  image: ImageLike
}> = ({ title, content, image }) => {
  const imageUrl = getImageUrl(image)
  return (
    <section className="py-20">
      <div className="container mx-auto items-center justify-between px-4 lg:flex">
        <div className="mb-12 pr-4 lg:mb-0">
          <h3 className="mb-8 text-2xl font-medium uppercase text-gray-800 lg:text-3xl">{title}</h3>
          <RichText data={content} className="prose" />
        </div>
        <div className="relative aspect-video h-full lg:h-72 2xl:h-96 w-full">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={getImageAlt(image)}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              style={{
                objectFit: 'cover',
              }}
            />
          )}
        </div>
      </div>
    </section>
  )
}

