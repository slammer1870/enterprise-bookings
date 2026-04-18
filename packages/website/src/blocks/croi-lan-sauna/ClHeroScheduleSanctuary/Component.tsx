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
    <section className="relative w-full min-h-[500px] md:min-h-[700px]">
      {/* Full-bleed split backgrounds; content width is controlled by the foreground container only */}
      <div
        className="pointer-events-none absolute inset-0 z-0 flex min-h-full flex-col md:flex-row"
        aria-hidden
      >
        <div className="relative min-h-[420px] w-full shrink-0 overflow-hidden md:min-h-0 md:h-full md:w-1/2 lg:w-2/3">
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
        <div className="min-h-0 w-full flex-1 bg-card md:min-h-full md:w-1/2 md:flex-shrink-0 lg:w-1/3" />
      </div>

      {/* Match atnd-me header: `container mx-auto` + inner `p-8` (medium padding default) */}
      <div className="flex flex-col gap-10 px-8 py-10 min-h-screen md:flex-row">
        <div className="flex min-h-[420px] flex-1 flex-col justify-center md:min-h-[700px] lg:basis-0 lg:flex-[2]">
          <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 text-left lg:mx-0 lg:max-w-lg lg:gap-5">
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
              <h1 className="text-3xl font-bold tracking-wide text-white drop-shadow-md md:text-4xl lg:text-5xl">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-lg font-medium text-white/95 drop-shadow md:text-xl">{subtitle}</p>
            )}
            {tagline && <p className="text-sm text-white/80 md:text-base">{tagline}</p>}
            {links && links.length > 0 && (
              <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
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
                          ? 'border-2 border-white bg-transparent text-white hover:bg-white hover:text-stone-900'
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

        <div className="flex flex-1 flex-col justify-center md:min-h-[700px] lg:basis-0 lg:flex-1">
          <div className="mx-auto w-full max-w-[min(100%,20rem)] text-card-foreground sm:max-w-sm md:mx-0 md:ml-auto md:max-w-[19rem] xl:max-w-[21rem]">
            <h2 className="mb-6 text-center text-2xl font-semibold normal-case tracking-normal text-card-foreground lg:text-left">
              Schedule
            </h2>
            {schedulePanel}
          </div>
        </div>
      </div>
    </section>
  )
}
