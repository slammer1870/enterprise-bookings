import React from 'react'

import { ImageMedia } from '@/components/Media/ImageMedia'
import RichText from '@/components/RichText'
import { cn } from '@/utilities/ui'

type Direction = 'ltr' | 'rtl'

type Props = {
  direction?: Direction
  image: unknown
  content: unknown
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
    <section className="w-full py-12">
      <div
        className={cn(
          'flex w-full flex-col gap-12 md:flex-row md:items-center',
          // RTL = image on the right, text on the left (layout only — not text direction)
          direction === 'rtl' && 'md:flex-row-reverse',
        )}
      >
        <div className="order-2 w-full min-w-0 rounded-lg overflow-hidden bg-card md:order-none md:flex-1">
          {imageResource ? (
            <ImageMedia
              resource={imageResource as any}
              alt={alt}
              imgClassName="w-full h-auto"
            />
          ) : null}
        </div>

        <div className="order-1 w-full min-w-0 text-left md:order-none md:flex-1" dir="ltr">
          <RichText
            data={content as any}
            enableGutter={false}
            className="mx-0 max-w-none text-left"
          />
        </div>
      </div>
    </section>
  )
}
