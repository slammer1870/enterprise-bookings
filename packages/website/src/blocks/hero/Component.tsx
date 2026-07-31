'use client'

import React from 'react'
import Image from 'next/image'
import { CMSButton } from '../../components/CMSButton'
import type { CMSButtonProps } from '../../components/CMSButton'

interface HeroBlockProps {
  backgroundImage: {
    url?: string
    alt?: string
  } | number | string
  logo?: {
    url?: string
    alt?: string
  } | number | string
  title?: string
  links?: Array<{
    link: CMSButtonProps
  }>
}

export const HeroBlock: React.FC<HeroBlockProps> = ({
  backgroundImage,
  logo,
  title,
  links,
}) => {
  const bgImageUrl =
    typeof backgroundImage === 'object' && backgroundImage?.url
      ? backgroundImage.url
      : typeof backgroundImage === 'string'
        ? backgroundImage
        : null

  const logoUrl =
    typeof logo === 'object' && logo?.url
      ? logo.url
      : typeof logo === 'string'
        ? logo
        : null

  return (
    <div
      className={`relative w-full min-h-[600px] md:min-h-[700px] flex items-center justify-center overflow-hidden`}
    >
      {bgImageUrl && (
        <div className="absolute inset-0 z-0">
          <Image
            src={bgImageUrl}
            alt={typeof backgroundImage === 'object' ? backgroundImage.alt || '' : ''}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}
      <div className="absolute top-24 lg:top-0 bottom-0 left-0 right-0 z-10 flex flex-col items-center justify-center gap-4 lg:gap-6 px-8 text-center max-w-lg lg:max-w-xl mx-auto">
        {logoUrl && (
          <div>
            <Image
              src={logoUrl}
              alt={typeof logo === 'object' ? logo.alt || '' : ''}
              width={160}
              height={160}
              className="rounded-full bg-white/10 backdrop-blur-sm p-4"
            />
          </div>
        )}
        {title && (
          <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
            {title}
          </h1>
        )}
        {links && links.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            {links.map((linkItem, index) => {
              if (!linkItem?.link) return null
              const appearance = linkItem.link.appearance || 'default'
              return (
                <CMSButton
                  key={index}
                  {...linkItem.link}
                  appearance={appearance}
                  label={linkItem.link.label || 'Learn More'}
                  className="w-auto flex-1"
                  backgroundColor={
                    linkItem.link.backgroundColor ??
                    (appearance === 'outline' ? '#ffffff' : '#ffffff')
                  }
                  foregroundColor={
                    linkItem.link.foregroundColor ??
                    (appearance === 'outline' ? '#ffffff' : '#111827')
                  }
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
