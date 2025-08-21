import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@repo/ui/components/ui/button'
import type { Media } from '@/payload-types'

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
  console.log('Background image:', backgroundImage)
  console.log('Logo:', logo)

  return (
    <section className="relative min-h-screen z-10">
      <Image
        src={backgroundImage.url || ''}
        alt={backgroundImage.alt}
        className="opacity-20"
        fill
        sizes="100vw"
        style={{
          objectFit: 'cover',
        }}
      />
      <div className="absolute flex h-full w-full items-center justify-center bg-white bg-opacity-50">
        <div className="container relative mx-auto flex min-h-screen flex-col flex-wrap items-center justify-start py-20 px-4 lg:-mt-20 lg:mb-0 lg:flex-row gap-4">
          <div className="mx-auto w-2/3 lg:w-1/2 xl:w-auto">
            <Image
              src={logo.url || ''}
              alt={logo.alt || ''}
              height={600}
              width={600}
              className="h-auto max-w-full p-4 lg:p-12"
              unoptimized
              style={{
                maxWidth: '100%',
                height: 'auto',
              }}
            />
          </div>
          <div className="lg:w-1/2">
            <div className="mb-8 lg:mb-0">
              <h1 className="text-lg font-medium text-gray-700">{title}</h1>
              <h2 className="mb-2 text-3xl font-medium uppercase leading-snug">{subtitle}</h2>
              <h3 className="mb-8 text-xl text-gray-700">{description}</h3>
            </div>
            <div className="flex w-full flex-col lg:flex-row gap-4">
              <Button
                asChild
                variant="default"
                size="lg"
                className="w-full bg-[#FECE7E] text-black hover:bg-[#FECE7E]/90 font-medium"
              >
                <Link href={primaryButton.link}>{primaryButton.text}</Link>
              </Button>
              {secondaryButton?.link && secondaryButton.text && (
                <Button asChild variant="secondary" size="lg" className="w-full font-medium">
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
