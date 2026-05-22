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
    <section className="relative w-full">
      {/* Full-bleed split backgrounds — image left/top, card right/bottom */}
      <div
        className="pointer-events-none absolute inset-0 z-0 flex flex-col md:flex-row"
        aria-hidden
      >
        <div className="relative min-h-[420px] w-full shrink-0 overflow-hidden md:h-full md:min-h-0 md:w-1/2 lg:w-2/3">
          {bgUrl ? (
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
              <div className="absolute inset-0 bg-stone-900/40" />
            </>
          ) : null}
        </div>
        <div className="w-full flex-1 bg-card md:min-h-full md:w-1/2 lg:w-1/3" />
      </div>

      {/* Foreground — z-10 ensures it sits above the absolute background layers */}
      <div className="relative z-10 flex min-h-screen flex-col md:flex-row">
        {/* Image panel: logo + CTA buttons centred, pt-28 clears the 112px absolute header (p-8 + h-12) */}
        <div className="flex min-h-[420px] flex-col items-center justify-center pt-28 pb-10 md:flex-1 lg:flex-[2]">
          <div className="flex w-full flex-col items-center gap-5 px-8 text-center">
            {logoUrl && (
              <Image
                src={logoUrl}
                alt={typeof logo === 'object' && logo && 'alt' in logo ? (logo.alt as string) || '' : ''}
                width={320}
                height={320}
                className="h-60 w-60 object-contain drop-shadow-xl md:h-80 md:w-80"
              />
            )}
            {links && links.length > 0 && (
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
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
                      size="lg"
                      variant={isOutline ? 'outline' : 'default'}
                      className={
                        isOutline
                          ? 'w-full border-2 border-white bg-transparent text-white hover:bg-white hover:text-stone-900 sm:w-auto'
                          : 'w-full bg-white text-stone-900 hover:bg-stone-100 sm:w-auto'
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

        {/* Schedule panel — starts just below the navbar on desktop (pt-28 = header height); stacks naturally on mobile */}
        <div className="flex flex-col justify-start bg-card px-8 pb-10 pt-28 md:flex-1 lg:flex-[1]">
          <div className="mx-auto w-full max-w-sm text-card-foreground">
            <h2 className="mb-6 text-center text-2xl font-semibold normal-case tracking-normal text-card-foreground">
              Schedule
            </h2>
            {schedulePanel}
          </div>
        </div>
      </div>
    </section>
  )
}
