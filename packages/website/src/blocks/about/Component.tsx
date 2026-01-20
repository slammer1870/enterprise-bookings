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
  disableInnerContainer?: boolean
}

export const AboutBlock: React.FC<AboutBlockProps> = ({
  title = 'About Us',
  image,
  content,
  disableInnerContainer,
}) => {
  const imageUrl =
    typeof image === 'object' && image?.url
      ? image.url
      : typeof image === 'string'
        ? image
        : null

  const contentElement = (
    <>
      {title && <h2 className="text-3xl font-bold mb-8 text-center">{title}</h2>}
      <div className="flex flex-col gap-8">
        {imageUrl && (
          <div className="relative w-full max-w-sm aspect-square rounded-lg overflow-hidden">
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
    </>
  )

  if (disableInnerContainer) {
    return (
      <section className="w-full py-12">
        <div className="max-w-6xl mx-auto px-8">{contentElement}</div>
      </section>
    )
  }

  return (
    <section className="container py-12">
      <div className="max-w-6xl mx-auto px-8">
        {contentElement}
      </div>
    </section>
  )
}
