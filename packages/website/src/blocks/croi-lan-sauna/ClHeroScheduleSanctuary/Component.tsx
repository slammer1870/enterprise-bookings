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
  displayHeading?: string | null
  backgroundImage?: MediaLike
  logo?: MediaLike
  links?: LinkItem[] | null
  /** Injected by the app (e.g. tenant schedule widget). */
  schedulePanel: React.ReactNode
}

export const ClHeroScheduleSanctuaryBlock: React.FC<ClHeroScheduleSanctuaryBlockProps> = ({
  displayHeading,
  backgroundImage,
  logo,
  links,
  schedulePanel,
}) => {
  const bgUrl = resolveMediaUrl(backgroundImage)
  const logoUrl = resolveMediaUrl(logo)
  const brandHeading =
    typeof displayHeading === 'string' && displayHeading.trim() ? displayHeading.trim() : null

  const brandMark = (opts: {
    logoClassName: string
    headingClassName: string
    wrapClassName?: string
  }) => {
    if (!logoUrl && !brandHeading) return null
    return (
      <div
        className={
          opts.wrapClassName ??
          'flex flex-col items-center justify-center gap-4 text-center'
        }
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={typeof logo === 'object' && logo && 'alt' in logo ? (logo.alt as string) || '' : ''}
            width={320}
            height={320}
            className={opts.logoClassName}
          />
        ) : null}
        {brandHeading ? <p className={opts.headingClassName}>{brandHeading}</p> : null}
      </div>
    )
  }

  const hasLinks = Boolean(links && links.length > 0)

  const renderCtaButtons = () => {
    if (!hasLinks || !links) return null
    return (
      <div className="flex w-full max-w-sm flex-col gap-3">
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
                  ? 'w-full border-2 border-white bg-transparent text-white hover:bg-white hover:text-stone-900'
                  : 'w-full bg-white text-stone-900 hover:bg-stone-100'
              }
            >
              <Link href={href} {...newTabProps}>
                {link.label || 'Book Your Session'}
              </Link>
            </Button>
          )
        })}
      </div>
    )
  }

  return (
    <section id="schedule" className="relative w-full md:min-h-screen">
      {/* Split backgrounds — image left/top (capped at screen height on md+), card right/bottom. */}
      <div
        className="pointer-events-none absolute inset-0 z-0 flex flex-col md:flex-row md:items-start"
        aria-hidden
      >
        <div className="relative h-[67vh] w-full shrink-0 overflow-hidden md:h-screen md:w-1/2 lg:w-7/12">
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
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 58vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-stone-900/40" />
            </>
          ) : null}
        </div>
        <div className="w-full flex-1 bg-card md:min-h-full md:w-1/2 lg:w-5/12" />
      </div>

      {/* Logo + brand heading + CTAs centred over the bg image area on md+ */}
      {(logoUrl || brandHeading || hasLinks) && (
        <div className="pointer-events-none absolute top-0 left-0 z-20 hidden h-screen flex-col items-center justify-center gap-8 md:flex md:w-1/2 lg:w-7/12">
          {brandMark({
            logoClassName: 'h-80 w-80 object-contain drop-shadow-xl lg:h-96 lg:w-96',
            headingClassName:
              'max-w-md text-4xl font-semibold tracking-tight text-stone-900 lg:text-5xl',
          })}
          {hasLinks ? (
            <div className="pointer-events-auto w-full max-w-sm px-6">{renderCtaButtons()}</div>
          ) : null}
        </div>
      )}

      {/* Foreground — same viewport split as the bg (1/2 | 1/2 on md, 7/12 | 5/12 on lg)
          so the schedule never overlaps the image. */}
      <div className="relative z-10 md:min-h-screen">
        <div className="flex w-full flex-col md:min-h-screen md:flex-row md:items-start">
          {/* Image panel: spacer on md+ (logo/CTAs are absolutely positioned above); height capped
              at the viewport so a tall schedule does not stretch this column. */}
          <div className="flex h-[67vh] flex-col items-center px-4 pt-24 pb-8 sm:px-6 md:h-screen md:w-1/2 md:shrink-0 md:px-0 md:pt-0 lg:w-7/12">
            {/* Logo + heading: mobile only — on md+ the absolute layer above handles this */}
            <div className="flex w-full min-h-0 flex-1 items-center justify-center md:hidden">
              {brandMark({
                wrapClassName:
                  'flex w-full max-w-md flex-col items-center justify-center gap-3 px-2 text-center',
                logoClassName:
                  'h-44 w-44 max-h-[36vh] object-contain drop-shadow-xl sm:h-56 sm:w-56',
                headingClassName:
                  'mt-1 w-full max-w-[18rem] px-3 py-2 text-3xl font-semibold leading-snug tracking-tight text-balance text-stone-900 sm:max-w-sm sm:text-4xl',
              })}
            </div>
            {/* Buttons: mobile only — desktop CTAs live in the absolute brand layer */}
            {hasLinks ? <div className="w-full max-w-sm md:hidden">{renderCtaButtons()}</div> : null}
          </div>

          {/* Schedule panel — same width as the card strip so it stays clear of the image.
              pr matches Header `container mx-auto` so the content right edge lines up with
              the navbar icons. */}
          <div className="flex flex-col justify-start bg-card px-4 pb-10 pt-8 sm:px-6 md:min-h-screen md:w-1/2 md:min-w-0 md:bg-transparent md:pl-8 md:pt-28 md:pr-[max(2rem,calc((100vw-48rem)/2+2rem))] lg:w-5/12 lg:pl-16 lg:pr-[max(2rem,calc((100vw-64rem)/2+2rem))] xl:pr-[max(2rem,calc((100vw-80rem)/2+2rem))] 2xl:pr-[max(2rem,calc((100vw-86rem)/2+2rem))]">
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
