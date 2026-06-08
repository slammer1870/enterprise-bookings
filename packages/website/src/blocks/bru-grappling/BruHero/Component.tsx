'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@repo/ui/components/ui/button'
import { useAnalyticsTracker } from '@repo/analytics'

type ImageLike =
  | {
    url?: string
    alt?: string
  }
  | number
  | string

function getImageUrl(image: ImageLike | undefined | null): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (typeof image === 'object' && image?.url) return image.url
  return null
}

function getImageAlt(image: ImageLike | undefined | null): string {
  if (!image) return ''
  if (typeof image === 'object') return image.alt || ''
  return ''
}

export const BruHeroBlock: React.FC<{
  backgroundImage: ImageLike
  logo: ImageLike
  title: string
  subtitle: string
  description: string
  primaryButton: {
    text: string
    /**
     * Can be null/empty when coming from CMS content.
     * Never pass null to `next/link` (it will crash server render).
     */
    link?: string | null
  }
  secondaryButton?: {
    text?: string
    link?: string | null
  }
}> = ({ backgroundImage, logo, title, subtitle, description, primaryButton, secondaryButton }) => {
  const { trackEvent } = useAnalyticsTracker()

  const bgUrl = getImageUrl(backgroundImage)
  const logoUrl = getImageUrl(logo)
  const primaryHref =
    typeof primaryButton?.link === 'string' && primaryButton.link.trim()
      ? primaryButton.link
      : null
  const secondaryHref =
    typeof secondaryButton?.link === 'string' && secondaryButton.link.trim()
      ? secondaryButton.link
      : null

  return (
    <section className="relative min-h-screen z-10">
      {bgUrl && (
        <Image
          src={bgUrl}
          alt={getImageAlt(backgroundImage)}
          className="opacity-20"
          fill
          sizes="100vw"
          priority
          style={{ objectFit: 'cover' }}
        />
      )}
      <div className="absolute inset-0 bg-white/50">
        <div className="container relative mx-auto grid min-h-screen grid-cols-1 items-center content-center gap-4 py-12 lg:mb-0 lg:grid-cols-2 lg:gap-4 lg:py-20">
          <div className="mx-auto w-2/3 justify-self-center lg:mx-0 lg:w-full lg:justify-self-auto xl:w-auto">
            {logoUrl && (
              <Image
                src={logoUrl}
                alt={getImageAlt(logo)}
                height={600}
                width={600}
                className="h-auto max-w-full p-4 lg:p-12"
                priority
                sizes="(max-width: 768px) 66vw, (max-width: 1024px) 50vw, 600px"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                }}
              />
            )}
          </div>
          <div className="w-full min-w-0">
            <div className="mb-8 lg:mb-0">
              <h1 className="text-lg font-medium text-gray-700">{title}</h1>
              <h2 className="mb-2 text-3xl font-medium uppercase leading-snug">{subtitle}</h2>
              <h3 className="mb-8 text-xl text-gray-700">{description}</h3>
            </div>
            <div className="flex w-full flex-col gap-4 sm:flex-row">
              {primaryHref ? (
                <Button
                  asChild
                  variant="default"
                  size="lg"
                  className="w-full bg-[#FECE7E] text-black hover:bg-[#FECE7E]/90 font-medium sm:flex-1"
                  onClick={() => {
                    trackEvent('Bru Trial Button Clicked')
                  }}
                >
                  <Link href={primaryHref}>{primaryButton.text}</Link>
                </Button>
              ) : null}
              {secondaryHref && secondaryButton?.text && (
                <Button asChild variant="secondary" size="lg" className="w-full font-medium sm:flex-1">
                  <Link href={secondaryHref}>{secondaryButton.text}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

