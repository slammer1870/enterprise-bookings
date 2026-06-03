import React from 'react'

import { ImageMedia } from '@/components/Media/ImageMedia'
import RichText from '@/components/RichText'
import { cn } from '@/utilities/ui'

type Direction = 'ltr' | 'rtl'

type Props = {
  direction?: Direction
  image: unknown
  content: unknown
  disableInnerContainer?: boolean
}

const resolveImageResource = (image: unknown) => {
  if (typeof image === 'string') {
    return { url: image }
  }
  if (typeof image === 'object' && image !== null) {
    return image as Record<string, unknown>
  }
  return null
}

const resolveImageAlt = (image: unknown): string | undefined => {
  if (typeof image === 'object' && image !== null) {
    const alt = (image as Record<string, unknown>).alt
    if (typeof alt === 'string') return alt
  }
  return undefined
}

export const SimpleAboutBlock: React.FC<Props> = ({
  direction = 'ltr',
  image,
  content,
}) => {
  const imageResource = resolveImageResource(image)
  const alt = resolveImageAlt(image)

  return (
    <section className="container px-4 py-12">
      <div
        className={cn(
          'mx-auto max-w-6xl flex flex-col gap-12 md:flex-row md:items-center',
          direction === 'rtl' && 'md:flex-row-reverse',
        )}
        dir={direction}
      >
        <div className="w-full max-w-[36rem] rounded-lg overflow-hidden bg-card">
          {imageResource ? (
            <ImageMedia
              resource={imageResource as any}
              alt={alt}
              imgClassName="w-full h-auto"
            />
          ) : null}
        </div>

        <div className="flex-1 text-left">
          <RichText
            data={content as any}
            enableGutter={false}
            disableTextAlign
            className="mx-0 max-w-none text-left"
          />
        </div>
      </div>
    </section>
  )
}

