import { Media } from '@/components/Media'
import { Page } from '@/payload-types'

import Link from 'next/link'

import RichText from '@/components/RichText'

import { Logo } from '@/graphics/Logo'

export const BruHero: React.FC<Page['hero']> = ({ links, media, richText }) => {
  return (
    <div className="relative min-h-screen">
      {media && typeof media === 'object' && (
        <Media
          fill
          imgClassName="-z-10 object-cover"
          priority={false}
          loading="lazy"
          resource={media}
        />
      )}
      <div className="absolute flex h-full w-full items-center justify-center bg-white bg-opacity-50">
        <div className="container relative mx-auto flex min-h-screen flex-col flex-wrap items-center justify-start py-20 px-4 lg:-mt-20 lg:mb-0 lg:flex-row">
          <div className="mx-auto w-2/3 lg:w-1/2 xl:w-auto">
            <Logo />
          </div>
          <div className="lg:w-1/2">
            <div className="mb-8 lg:mb-0">
              {richText && <RichText className="mb-6" data={richText} enableGutter={false} />}
            </div>
            <div className="flex w-full flex-col lg:flex-row">
              {Array.isArray(links) &&
                links.length > 0 &&
                links.map((link) => (
                  <Link
                    href={link.link.url as string}
                    key={link.link.label}
                    className="mb-4 w-full bg-[#FECE7E] p-2 text-center font-medium lg:mr-4 lg:mb-0"
                  >
                    {link.link.label}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
