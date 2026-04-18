'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@repo/ui/components/ui/button'
import { ScheduleLazy } from '@/components/bookings/ScheduleLazy'
import type { Media } from '@/payload-types'
import { getMediaUrl } from '@/utilities/getMediaUrl'

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

interface HeroWithLocationBlockProps {
  backgroundImage?: number | Media | { url?: string; alt?: string } | string | null
  imageOverlayHex?: string | null
  imageOverlayOpacity?: number | null
  logo?: (number | null) | Media | { url?: string; alt?: string } | string | null
  title?: string | null
  titleLine2?: string | null
  titleLine1Accent?: boolean | null
  locationText?: string | null
  locationSubtext?: string | null
  showLocationIcon?: boolean | null
  links?: LinkItem[] | null
  socialFollowLabel?: string | null
  socialFollowUrl?: string | null
  /** Croí Lán hero: paragraph below primary CTAs */
  introTagline?: string | null
  disableInnerContainer?: boolean
}

function resolveMediaUrl(
  media:
    | number
    | Media
    | { url?: string; updatedAt?: string; alt?: string }
    | string
    | null
    | undefined,
): string | undefined {
  if (media == null) return undefined
  if (typeof media === 'string') return media
  if (typeof media === 'number') return undefined
  const m = media as { url?: string; updatedAt?: string; alt?: string }
  if (m.url && typeof m.url === 'string') {
    return getMediaUrl(m.url, m.updatedAt) || undefined
  }
  return undefined
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

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

const DEFAULT_OVERLAY_HEX = '#000000'
const DEFAULT_OVERLAY_OPACITY = 70

export const HeroWithLocationBlock: React.FC<HeroWithLocationBlockProps> = ({
  backgroundImage,
  imageOverlayHex,
  imageOverlayOpacity,
  logo,
  title,
  titleLine2,
  titleLine1Accent = true,
  locationText,
  locationSubtext,
  showLocationIcon = true,
  links,
  socialFollowLabel,
  socialFollowUrl,
  introTagline,
  disableInnerContainer: _disableInnerContainer,
}) => {
  const bgUrl = resolveMediaUrl(backgroundImage)
  const logoUrl = resolveMediaUrl(logo)
  const hasSocialFollow = Boolean(socialFollowLabel && socialFollowUrl)
  const isInstagram = socialFollowUrl?.toLowerCase().includes('instagram')
  const overlayColor = imageOverlayHex?.trim() || DEFAULT_OVERLAY_HEX
  const overlayOpacity = (imageOverlayOpacity ?? DEFAULT_OVERLAY_OPACITY) / 100

  return (
    <section className="relative w-full min-h-[500px] overflow-hidden md:min-h-[700px]">
      {/* Full-bleed image + overlay across the entire hero (schedule card sits on top in the foreground) */}
      <div
        className="pointer-events-none absolute inset-0 z-0 min-h-full bg-stone-900"
        aria-hidden
      >
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
              sizes="100vw"
              className="object-cover"
              priority
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: overlayColor,
                opacity: overlayOpacity,
              }}
            />
          </>
        ) : null}
      </div>

      {/* Align with HeaderClient: `container mx-auto` + inner padding; pt clears absolute header; items align to top */}
      <div className="relative z-10 flex min-h-[500px] w-full flex-col md:min-h-[700px]">
        <div className="container mx-auto flex w-full flex-1 flex-col md:min-h-[700px]">
          <div className="flex min-h-[500px] flex-1 flex-col gap-8 px-8 pb-10 pt-32 md:min-h-[700px] md:flex-row md:items-start md:gap-8 md:px-8 md:pb-8 md:pt-36 lg:gap-12 lg:pt-40">
            <div className="flex min-h-[300px] flex-1 flex-col justify-center md:justify-start md:min-h-[700px] lg:basis-0 lg:flex-[2]">
              <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 text-left lg:mx-0 lg:max-w-lg lg:gap-5">
                {logoUrl && (
                  <div className="mb-1 flex-shrink-0">
                    <Image
                      src={logoUrl}
                      alt={typeof logo === 'object' && logo && 'alt' in logo ? (logo.alt as string) || '' : ''}
                      width={80}
                      height={80}
                      className="object-contain"
                    />
                  </div>
                )}

                {title && (
                  <h1 className="text-5xl font-bold tracking-tight drop-shadow-md md:text-6xl lg:text-7xl">
                    <span className={titleLine1Accent ? 'text-orange-400' : 'text-white'}>{title}</span>
                    {titleLine2 && (
                      <>
                        <br />
                        <span className="text-white">{titleLine2}</span>
                      </>
                    )}
                  </h1>
                )}

                {(locationText || locationSubtext) && (
                  <div className="flex flex-col gap-0.5 text-white/95">
                    {locationText && (
                      <div className="flex items-center gap-2">                      {showLocationIcon && (
                        <span className="flex-shrink-0 text-orange-400" aria-hidden>
                          <MapPinIcon />
                        </span>
                      )}
                        <span className="text-base md:text-lg">{locationText}</span>
                      </div>
                    )}
                    {locationSubtext && (
                      <p
                        className={`text-sm text-white/80 md:text-base ${showLocationIcon ? 'pl-7' : ''}`}
                      >
                        {locationSubtext}
                      </p>
                    )}
                  </div>
                )}

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
                              : 'border-0 bg-orange-500 text-white hover:bg-orange-600'
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

                {introTagline ? (
                  <p className="mt-2 max-w-xl text-base leading-relaxed text-white/90 md:text-lg">{introTagline}</p>
                ) : null}

                {hasSocialFollow && (
                  <div className="mt-8">
                    <Link
                      href={socialFollowUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-white/95 transition-colors hover:text-white"
                    >
                      {isInstagram ? (
                        <InstagramIcon className="flex-shrink-0" />
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center" aria-hidden>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden
                          >
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                        </span>
                      )}
                      <span className="text-sm font-medium">{socialFollowLabel}</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            <div className="flex w-full flex-1 flex-col justify-start md:min-h-[700px] lg:basis-0 lg:flex-1">
              <div className="w-full text-card-foreground md:ml-auto md:max-w-[20rem] lg:max-w-[24rem] xl:max-w-[26rem]">
                <div className="w-full rounded-sm bg-background p-6 shadow-md md:p-8">
                  <h2 className="mb-6 text-center text-2xl font-semibold normal-case tracking-normal text-foreground">
                    Schedule
                  </h2>
                  <ScheduleLazy />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
