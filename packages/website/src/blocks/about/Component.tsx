'use client'

import React from 'react'
import Image from 'next/image'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

interface AboutBlockProps {
  title?: string
  image: {
    url?: string
    alt?: string
  } | number | string
  content: SerializedEditorState
}

export const AboutBlock: React.FC<AboutBlockProps> = ({ title = 'About Us', image, content }) => {
  const imageUrl =
    typeof image === 'object' && image?.url
      ? image.url
      : typeof image === 'string'
        ? image
        : null

  return (
    <section className="container p-4">
      <div className="max-w-6xl mx-auto">
        {title && <h2 className="text-3xl font-bold mb-8 text-center">{title}</h2>}
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {imageUrl && (
            <div className="relative w-full h-[400px] rounded-lg overflow-hidden">
              <Image
                src={imageUrl}
                alt={typeof image === 'object' ? image.alt || '' : ''}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="prose prose-lg max-w-none">
            <RichText data={content} />
          </div>
        </div>
      </div>
    </section>
  )
}
