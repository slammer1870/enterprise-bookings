'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@repo/ui/components/ui/button'
import { Schedule } from '@repo/bookings-next'
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

export const HeroWithLocationBlock: React.FC<HeroWithLocationBlockProps> = ({
  backgroundImage,
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
}) => {
  const bgUrl = resolveMediaUrl(backgroundImage)
  const logoUrl = resolveMediaUrl(logo)
  const hasSocialFollow = Boolean(socialFollowLabel && socialFollowUrl)
  const isInstagram = socialFollowUrl?.toLowerCase().includes('instagram')

  return (
    <div className="flex flex-col md:flex-row w-full">
      {/* Hero Section - Full width on mobile, half width on desktop (same layout as Hero with Schedule) */}
      <div className="relative w-full md:w-1/2 lg:w-2/3 flex-shrink-0 min-h-[600px] md:min-h-[750px] flex items-center justify-start overflow-hidden">
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
            <div className="absolute inset-0 bg-black/40" aria-hidden />
          </>
        )}

        <div className="relative z-10 flex flex-col justify-center gap-4 px-6 py-16 md:px-12 lg:px-16 max-w-2xl">
          {logoUrl && (
            <div className="flex-shrink-0 mb-2">
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
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight drop-shadow-md">
              <span
                className={
                  titleLine1Accent
                    ? 'text-orange-400'
                    : 'text-white'
                }
              >
                {title}
              </span>
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
                <div className="flex items-center gap-2">
                  {showLocationIcon && (
                    <span className="text-orange-400 flex-shrink-0" aria-hidden>
                      <MapPinIcon />
                    </span>
                  )}
                  <span className="text-base md:text-lg">{locationText}</span>
                </div>
              )}
              {locationSubtext && (
                <p className="text-sm md:text-base text-white/80 pl-7">{locationSubtext}</p>
              )}
            </div>
          )}

          {links && links.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
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
                        : 'bg-orange-500 hover:bg-orange-600 text-white border-0'
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

        {hasSocialFollow && (
          <div className="absolute bottom-6 left-6 md:left-12 z-10">
            <Link
              href={socialFollowUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white/95 hover:text-white transition-colors"
            >
              {isInstagram ? (
                <InstagramIcon className="flex-shrink-0" />
              ) : (
                <span className="w-5 h-5 flex items-center justify-center" aria-hidden>
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

      {/* Schedule Section - Card inside container width */}
      <div className="w-full md:w-1/2 lg:w-1/3 flex items-center justify-center p-8 lg:p-12 bg-white">
        <div className="w-full max-w-lg">
          <div className="rounded-xl bg-stone-200/80 shadow-md p-6 md:p-8 w-full">
            <h2 className="text-3xl font-bold mb-6 text-center text-stone-900">Schedule</h2>
            <Schedule />
          </div>
        </div>
      </div>
    </div>
  )
}
