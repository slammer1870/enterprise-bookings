import Link from 'next/link'

import Image from 'next/image'

import HeroLogo from '@/logos/hero-logo'

import { VideoModal } from '@/components/video-modal'

import type { Media } from '@/payload-types'

import { Button } from '@repo/ui/components/ui/button'

interface HeroBlockProps {
  tagline: string
  image: Media
  video: Media
  cta?: {
    text: string
    variant: 'default' | 'outline'
    url: string
  }[]
}

export const HeroBlock = (props: HeroBlockProps) => {
  const { tagline, image, video, cta } = props

  return (
    <div className="max-w-screen-sm mx-auto p-6 flex flex-col gap-4 items-center justify-start">
      <div className="flex flex-col items-center justify-center mx-auto">
        <HeroLogo />
        <div>
          <div className="my-6">
            <div className="relative">
              <Image
                src={image.url || '/placeholder.svg'}
                alt={image.alt || ''}
                width={image.width || 0}
                height={image.height || 0}
                className="w-full h-auto aspect-video"
                priority
              />
              <VideoModal videoSrc={video.url || ''} />
            </div>
          </div>
        </div>
        <p className="text-xl text-center">{tagline}</p>
      </div>
      <div className="flex flex-col gap-4 w-full">
        {cta?.map((item) => (
          <Link key={item.text} href={item.url}>
            <Button variant={item.variant} className="w-full">
              {item.text}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  )
}
