'use client'

import React from 'react'

import type { Media } from '@/payload-types'
import Image from 'next/image'

import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

type AboutProps = {
  heading: string
  content: SerializedEditorState
  image: Media
}

export const AboutBlock: React.FC<AboutProps> = ({ heading, content, image }) => {
  return (
    <section className="text-gray-900 lg:mx-40">
      <div className="py-12 md:py-20 lg:py-24 px-4 md:flex items-center justify-around w-full">
        <div className="lg:w-1/2">
          <h3 className="text-3xl mb-4 font-medium">{heading}</h3>
          <div className="leading-relaxed text-gray-700 hidden md:block pr-12 xl:text-xl">
            <RichText data={content} className="prose" />
          </div>
        </div>
        <Image
          src={image.url || ''}
          className="my-8 object-cover aspect-square md:w-1/2 xl:w-1/3"
          alt={image.alt || 'about'}
          width={image.width || 0}
          height={image.height || 0}
        />
        <div className="leading-relaxed text-gray-700 md:hidden">
          <RichText data={content} className="prose" />
        </div>
      </div>
    </section>
  )
}
