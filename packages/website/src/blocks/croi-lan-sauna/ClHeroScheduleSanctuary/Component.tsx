'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@repo/ui/components/ui/button'

type LinkItem = {
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
}

type MediaLike =
  | number
  | string
  | null
  | undefined
  | {
    url?: string | null
    updatedAt?: string | null
    alt?: string | null
  }

function resolveMediaUrl(media: MediaLike): string | undefined {
  if (media == null) return undefined
  if (typeof media === 'string') return media
  if (typeof media === 'number') return undefined
  const url = media.url
  if (!url || typeof url !== 'string') return undefined
  const tag = media.updatedAt
  if (tag) {
    const q = encodeURIComponent(tag)
    return url.includes('?') ? `${url}&${q}` : `${url}?${q}`
  }
  return url
}

function getHref(link: LinkItem['link']): string {
  if (!link) return '#'
  if (link.type === 'reference' && link.reference) {
    const ref = link.reference.value
    const slug = typeof ref === 'object' && ref?.slug ? ref.slug : ''
    const relationTo = link.reference.relationTo
    return relationTo !== 'pages' ? `/${relationTo}/${slug}` : `/${slug}`
  }
  return link.url || '#'
}

export type ClHeroScheduleSanctuaryBlockProps = {
  backgroundImage?: MediaLike
  logo?: MediaLike
  title?: string | null
  subtitle?: string | null
  tagline?: string | null
  links?: LinkItem[] | null
  /** Injected by the app (e.g. tenant schedule widget). */
  schedulePanel: React.ReactNode
}

export const ClHeroScheduleSanctuaryBlock: React.FC<ClHeroScheduleSanctuaryBlockProps> = ({
  backgroundImage,
  logo,
  title,
  subtitle,
  tagline,
  links,
  schedulePanel,
}) => {
  const bgUrl = resolveMediaUrl(backgroundImage)
  const logoUrl = resolveMediaUrl(logo)

  return (
    <div className="flex flex-col md:flex-row w-full">
      <div className="relative flex min-h-[500px] w-full flex-shrink-0 flex-col overflow-hidden md:min-h-[700px] md:w-1/2 lg:w-2/3">
        {bgUrl && (
          <>
            <Image
              src={bgUrl}
              alt={
                typeof backgroundImage === 'object' && backgroundImage && 'alt' in backgroundImage
                  ? (backgroundImage.alt as string) || ''
                  : ''
              }
              fill
              sizes="(max-width: 768px) 100vw, 66vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-stone-900/40" aria-hidden />
          </>
        )}
        <div className="relative z-10 flex flex-1 flex-col justify-center">
          <div className="container mx-auto w-full px-4 py-12 md:px-6 lg:px-8">
            <div className="mx-auto flex max-w-lg flex-col items-center gap-3 text-center lg:gap-5">
              {logoUrl && (
                <div className="flex-shrink-0">
                  <Image
                    src={logoUrl}
                    alt={typeof logo === 'object' && logo && 'alt' in logo ? (logo.alt as string) || '' : ''}
                    width={120}
                    height={120}
                    className="object-contain"
                  />
                </div>
              )}
              {title && (
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-wide drop-shadow-md">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-white/95 text-lg md:text-xl font-medium drop-shadow">{subtitle}</p>
              )}
              {tagline && <p className="text-white/80 text-sm md:text-base">{tagline}</p>}
              {links && links.length > 0 && (
                <div className="mt-2 flex w-full flex-col justify-center gap-3 sm:flex-row">
                  {links.map((linkItem, index) => {
                    if (!linkItem?.link) return null
                    const { link } = linkItem
                    const href = getHref(link)
                    const isOutline = link.appearance === 'outline'
                    const newTabProps = link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {}
                    return (
                      <Button
                        key={index}
                        asChild
                        variant={isOutline ? 'outline' : 'default'}
                        className={
                          isOutline
                            ? 'border-2 border-white text-white hover:bg-white hover:text-stone-900 bg-transparent'
                            : 'bg-white text-stone-900 hover:bg-stone-100'
                        }
                      >
                        <Link href={href} {...newTabProps}>
                          {link.label || 'Book Your Session'}
                        </Link>
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col justify-center bg-card text-card-foreground md:w-1/2 lg:w-1/3">
        <div className="container mx-auto w-full px-4 py-12 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-lg">
            <h2 className="mb-6 text-center text-2xl font-semibold text-card-foreground">Schedule</h2>
            {schedulePanel}
          </div>
        </div>
      </div>
    </div>
  )
}
