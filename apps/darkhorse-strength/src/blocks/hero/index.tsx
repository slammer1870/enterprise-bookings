import React from 'react'
import Link from 'next/link'

import type { Media } from '@/payload-types'

type HeroProps = {
  heading: string
  subheading: string
  ctaLink: string
  ctaTitle: string
  ctaDescription: string
  backgroundImage: Media
}

export const HeroBlock: React.FC<HeroProps> = ({
  heading,
  subheading,
  ctaLink,
  ctaTitle,
  ctaDescription,
  backgroundImage,
}) => {
  return (
    <div
      className="mb-12 grid min-h-screen grid-rows-2 bg-foreground/70 bg-cover bg-center bg-blend-overlay"
      style={{ backgroundImage: `url(${backgroundImage.url})` }}
    >
      <div className="container row-span-1 mx-auto flex flex-col items-start justify-center px-6 md:px-8 pt-12 md:pt-16 lg:row-span-2">
        <h1 className="mb-2 text-2xl font-medium text-background md:text-4xl">{heading}</h1>
        <h3 className="text-xl text-primary md:text-2xl">{subheading}</h3>
      </div>
      <div className="row-span-1 flex h-auto w-full flex-col justify-center bg-destructive text-destructive-foreground lg:flex-row">
        <Link href={ctaLink}>
          <div className="bg-opacity-85 w-full cursor-pointer px-6 md:px-8 lg:py-16">
            <div className="container relative mx-auto h-full p-6 md:p-8">
              <h5 className="mb-2 text-xl  md:text-2xl lg:mb-4">{ctaTitle}</h5>
              <p className="flex flex-col pb-8 md:text-lg">{ctaDescription}</p>
              <div className="absolute bottom-0 right-0 flex items-center p-4">
                <span className="text-sm font-medium lg:text-base">More Information</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 22.26 14.352"
                  className="ml-4 h-3 md:h-4"
                >
                  <line
                    id="Line_22"
                    data-name="Line 22"
                    x2="19.591"
                    transform="translate(0 7.153)"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <line
                    id="Line_23"
                    data-name="Line 23"
                    x2="7.167"
                    y2="7.167"
                    transform="translate(14.385 0.707)"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <line
                    id="Line_24"
                    data-name="Line 24"
                    x2="7.167"
                    y2="7.167"
                    transform="translate(21.553 6.478) rotate(90)"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
