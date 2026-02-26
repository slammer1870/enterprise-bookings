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

type Section = {
  title: string
  content: SerializedEditorState
  image: ImageLike
  imagePosition: 'left' | 'right'
}

export const BruAboutBlock: React.FC<{
  sections: Section[]
}> = ({ sections }) => {
  return (
    <>
      {sections.map((section, index) => {
        const imageUrl = getImageUrl(section.image)
        const isLeft = section.imagePosition === 'left'

        return (
          <section
            key={index}
            className="relative flex flex-col items-center justify-center py-20 lg:min-h-screen lg:flex-row overflow-hidden"
          >
            <div
              className={`container mx-auto mb-12 px-4 lg:mb-0 lg:relative lg:z-10 ${
                isLeft
                  ? 'lg:flex lg:order-2 lg:pl-[calc(33.333%+2rem)] lg:pr-4'
                  : 'lg:order-1 lg:pr-[calc(33.333%+2rem)] lg:pl-4'
              }`}
            >
              <div className={`${isLeft ? 'lg:ml-auto lg:w-2/3 xl:w-auto' : ''}`}>
                <h3 className="mb-8 text-2xl font-medium uppercase text-gray-800 lg:text-3xl">
                  {section.title}
                </h3>
                <RichText
                  data={section.content}
                  className="prose prose-a:text-blue-500 [&_p]:mb-4 [&_p]:lg:text-xl [&_ul]:list-disc [&_ul]:pl-6 [&_ul_li]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol_li]:my-2"
                />
              </div>
            </div>

            <div
              className={`w-2/3 lg:absolute lg:w-1/3 2xl:w-auto lg:h-full lg:z-0 lg:top-0 ${
                !isLeft ? 'mr-0 ml-auto lg:right-0' : 'ml-0 mr-auto lg:left-0'
              }`}
            >
              <div className="relative overflow-hidden w-full h-full min-h-[240px]">
                {imageUrl && (
                  <Image
                    src={imageUrl}
                    alt={section.title}
                    fill
                    sizes="(max-width: 1024px) 66vw, 33vw"
                    className="h-auto w-full object-cover lg:h-full"
                    style={{ objectFit: 'cover' }}
                  />
                )}
              </div>
            </div>
          </section>
        )
      })}
    </>
  )
}

