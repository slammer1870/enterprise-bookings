'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@repo/ui/components/ui/button'

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
    link: {
      type?: 'reference' | 'custom'
      url?: string
      label?: string
      appearance?: 'default' | 'outline'
      newTab?: boolean
      reference?: {
        value: string | number | { slug?: string }
        relationTo: string
      }
    }
  }>
  disableInnerContainer?: boolean
}

export const HeroBlock: React.FC<HeroBlockProps> = ({
  backgroundImage,
  logo,
  title,
  links,
  disableInnerContainer,
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

  type LinkType = {
    type?: 'reference' | 'custom'
    url?: string
    label?: string
    appearance?: 'default' | 'outline'
    newTab?: boolean
    reference?: {
      value: string | number | { slug?: string }
      relationTo: string
    }
  }

  const getHref = (link: LinkType | undefined) => {
    if (!link) return '#'
    if (link.type === 'reference' && link.reference) {
      const ref = link.reference.value
      const slug = typeof ref === 'object' && ref?.slug ? ref.slug : ''
      const relationTo = link.reference.relationTo
      return relationTo !== 'pages' ? `/${relationTo}/${slug}` : `/${slug}`
    }
    return link.url || '#'
  }

  return (
    <div className={`relative w-full ${disableInnerContainer ? 'h-full' : 'h-[600px] md:h-[700px]'} flex items-center justify-center overflow-hidden`}>
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
      <div className="relative z-10 flex flex-col items-center justify-center gap-6 px-4 text-center">
        {logoUrl && (
          <div className="mb-4">
            <Image
              src={logoUrl}
              alt={typeof logo === 'object' ? logo.alt || '' : ''}
              width={200}
              height={200}
              className="rounded-full bg-white/10 backdrop-blur-sm p-4"
            />
          </div>
        )}
        {title && (
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg">
            {title}
          </h1>
        )}
        {links && links.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full">
            {links.map((linkItem, index) => {
              if (!linkItem?.link) return null
              const { link } = linkItem
              const appearance = link.appearance || 'default'
              const href = getHref(link)
              const newTabProps = link.newTab
                ? { rel: 'noopener noreferrer', target: '_blank' }
                : {}

              return (
                <Button
                  key={index}
                  asChild
                  variant={appearance === 'outline' ? 'outline' : 'default'}
                  className={
                    appearance === 'outline'
                      ? 'border-2 border-white text-white hover:bg-white hover:text-gray-900 bg-transparent w-auto flex-1'
                      : 'bg-white text-gray-900 hover:bg-gray-100 w-auto flex-1'
                  }
                >
                  <Link href={href} {...newTabProps}>
                    {link.label || 'Learn More'}
                  </Link>
                </Button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
