import HeroLogo from '@/logos/hero-logo'

import { VideoModal } from '@/components/video-modal'

import type { Media } from '@/payload-types'

interface HeroBlockProps {
  tagline: string
  image: Media
  video: Media
}

export const HeroBlock = (props: HeroBlockProps) => {
  const { tagline, image, video } = props

  return (
    <div className="max-w-screen-sm min-h-screen mx-auto p-6 flex flex-col items-center justify-center">
      <HeroLogo />
      <div>
        <div className="py-6">
          <VideoModal
            imageSrc={image.url || ''}
            videoSrc={video.url || ''}
            imageAlt={image.alt || ''}
          />
        </div>
      </div>
      <p className="text-xl text-center">{tagline}</p>
    </div>
  )
}
