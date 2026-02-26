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

type Testimonial = {
  image: ImageLike
  name: string
  role: string
  testimonial: SerializedEditorState
}

export const BruTestimonialsBlock: React.FC<{
  title: string
  testimonials: Testimonial[]
}> = ({ title, testimonials }) => {
  return (
    <section>
      <div className="container mx-auto px-4 pt-20">
        <h3 className="mb-8 text-2xl font-medium uppercase text-gray-800 lg:text-3xl">{title}</h3>
        <div className="flex flex-wrap">
          {testimonials.map((t, index) => {
            const imageUrl = getImageUrl(t.image)
            return (
              <div key={index} className="flex items-start py-4 md:w-1/2 xl:w-1/4">
                <div className="relative h-24 w-24">
                  {imageUrl && (
                    <Image
                      src={imageUrl}
                      fill
                      sizes="96px"
                      style={{ objectFit: 'cover' }}
                      className="rounded-full"
                      alt={`Testimonial ${t.name}`}
                    />
                  )}
                </div>
                <div className="w-3/4 pl-4">
                  <div className="mb-2 pr-8 text-gray-900">
                    <RichText data={t.testimonial} className="prose prose-sm" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    {t.name}, {t.role}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

