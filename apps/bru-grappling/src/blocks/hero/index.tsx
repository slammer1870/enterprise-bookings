'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@repo/ui/components/ui/button'
import { OptimizedImage } from '@/components/OptimizedImage'
import type { Media } from '@/payload-types'

import { useAnalyticsTracker } from '@repo/analytics'

export const HeroBlock: React.FC<{
  backgroundImage: Media
  logo: Media
  title: string
  subtitle: string
  description: string
  primaryButton: {
    text: string
    link: string
  }
  secondaryButton?: {
    text: string
    link: string
  }
}> = ({ backgroundImage, logo, title, subtitle, description, primaryButton, secondaryButton }) => {
  const { trackEvent } = useAnalyticsTracker()

  return (
    <section className="relative min-h-screen z-10">
      <OptimizedImage
        media={backgroundImage}
        className="opacity-20"
        fill
        sizes="100vw"
        priority
        style={{
          objectFit: 'cover',
        }}
      />
      <div className="absolute inset-0 bg-white/50">
        <div className="container relative mx-auto grid min-h-screen grid-cols-1 items-center gap-4 py-20 lg:-mt-20 lg:mb-0 lg:grid-cols-2">
          <div className="mx-auto w-2/3 justify-self-center lg:mx-0 lg:w-full lg:justify-self-auto xl:w-auto">
            <OptimizedImage
              media={logo}
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
          </div>
          <div className="w-full min-w-0">
            <div className="mb-8 lg:mb-0">
              <h1 className="text-lg font-medium text-gray-700">{title}</h1>
              <h2 className="mb-2 text-3xl font-medium uppercase leading-snug">{subtitle}</h2>
              <h3 className="mb-8 text-xl text-gray-700">{description}</h3>
            </div>
            <div className="flex w-full flex-col gap-4 sm:flex-row">
              <Button
                asChild
                variant="default"
                size="lg"
                className="w-full bg-[#FECE7E] text-black hover:bg-[#FECE7E]/90 font-medium sm:flex-1"
                onClick={() => {
                  trackEvent('Trial Button Clicked')
                }}
              >
                <Link href={primaryButton.link}>{primaryButton.text}</Link>
              </Button>
              {secondaryButton?.link && secondaryButton.text && (
                <Button asChild variant="secondary" size="lg" className="w-full font-medium sm:flex-1">
                  <Link href={secondaryButton.link}>{secondaryButton.text}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
