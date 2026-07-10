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
  links?: LinkItem[] | null
  /** Injected by the app (e.g. tenant schedule widget). */
  schedulePanel: React.ReactNode
}

export const ClHeroScheduleSanctuaryBlock: React.FC<ClHeroScheduleSanctuaryBlockProps> = ({
  backgroundImage,
  logo,
  links,
  schedulePanel,
}) => {
  const bgUrl = resolveMediaUrl(backgroundImage)
  const logoUrl = resolveMediaUrl(logo)

  return (
    <section id="schedule" className="relative w-full">
      {/* Full-bleed split backgrounds — image left/top, card right/bottom */}
      <div
        className="pointer-events-none absolute inset-0 z-0 flex flex-col md:flex-row"
        aria-hidden
      >
        <div className="relative h-[67vh] w-full shrink-0 overflow-hidden md:h-full md:w-1/2 lg:w-7/12">
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

      {/* Logo centred over the bg image area on md+ — absolutely positioned to match the
          full-bleed image panel (md:w-1/2 lg:w-7/12) so it stays centred regardless of
          the container width. Hidden on mobile where it sits inside the flex flow. */}
      {logoUrl && (
        <div className="pointer-events-none absolute top-0 left-0 z-20 hidden h-screen items-center justify-center md:flex md:w-1/2 lg:w-7/12">
          <Image
            src={logoUrl}
            alt={typeof logo === 'object' && logo && 'alt' in logo ? (logo.alt as string) || '' : ''}
            width={320}
            height={320}
            className="h-80 w-80 object-contain drop-shadow-xl lg:h-96 lg:w-96"
          />
        </div>
      )}

      {/* Foreground — container mx-auto mirrors the navbar so the schedule panel's right edge
          aligns with the rightmost navbar item. The absolute bg layer stays full-bleed. */}
      <div className="relative z-10 min-h-screen">
        <div className="container mx-auto flex min-h-screen flex-col md:flex-row">
          {/*  panel: spacer on md+ (logo is absolutely positioned above); on mobile
              the logo sits in the flex flow with flex-1 and buttons pinned to bottom. */}
          <div className="flex h-[67vh] flex-col items-center pt-12 pb-8 md:h-auto md:flex-1 lg:flex-[2]">
            {/* Logo: mobile only — on md+ the absolute layer above handles this */}
            <div className="flex w-full flex-1 items-center justify-center md:hidden">
              {logoUrl && (
                <Image
                  src={logoUrl}
                  alt={typeof logo === 'object' && logo && 'alt' in logo ? (logo.alt as string) || '' : ''}
                  width={320}
                  height={320}
                  className="h-60 w-60 object-contain drop-shadow-xl"
                />
              )}
            </div>
            {/* Buttons: mobile only — hidden on md+ where the schedule panel is visible */}
            {links && links.length > 0 && (
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center md:hidden">
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

          {/* Schedule panel — on md+ the absolute bg supplies the card colour so we go transparent here;
              on mobile bg-card keeps the stacked panel white. pt-28 on md+ clears the fixed header. */}
          <div className="flex flex-col justify-start bg-card md:bg-transparent pb-10 pt-8 md:pt-28 md:pl-12 lg:pl-0 md:flex-1 md:min-w-0 lg:flex-[1]">
            <div className="w-full min-w-0 text-card-foreground">
              <h2 className="mb-6 text-center text-2xl font-semibold normal-case tracking-normal text-card-foreground">
                Schedule
              </h2>
              {schedulePanel}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
