import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/ui'
import React from 'react'
import ClientRichText from '@/components/RichText/Client'

import type { MediaBlock as MediaBlockProps } from '@/payload-types'

import { Media } from '../../components/Media'

type Props = MediaBlockProps & {
  breakout?: boolean
  captionClassName?: string
  className?: string
  enableGutter?: boolean
  imgClassName?: string
  staticImage?: StaticImageData
}

export const MediaBlock: React.FC<Props> = (props) => {
  const {
    captionClassName,
    className,
    enableGutter = true,
    imgClassName,
    media,
    staticImage,
  } = props

  let caption
  if (media && typeof media === 'object') caption = media.caption

  return (
    <div
      className={cn(
        'max-w-full',
        {
          container: enableGutter,
        },
        className,
      )}
    >
      {(media || staticImage) && (
        <Media
          className="max-w-full"
          imgClassName={cn('border border-border rounded-[0.8rem] max-w-full h-auto', imgClassName)}
          resource={media}
          src={staticImage}
        />
      )}
      {caption && (
        <div className={cn('mt-6', captionClassName)}>
          <ClientRichText data={caption} enableGutter={false} />
        </div>
      )}
    </div>
  )
}
