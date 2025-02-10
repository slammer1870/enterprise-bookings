import { Media } from '@/payload-types'
import Image from 'next/image'
interface HeroBlockProps {
  title: string
  backgroundImage: Media
}

export const HeroBlock = (props: HeroBlockProps) => {
  const { title, backgroundImage } = props

  return (
    <div className="relative min-h-[80vh]">
      {backgroundImage && (
        <Image
          src={backgroundImage.url ?? ''}
          alt={backgroundImage.alt ?? ''}
          width={backgroundImage.width ?? 0}
          height={backgroundImage.height ?? 0}
          className="absolute inset-0 h-full w-full object-cover -z-10"
        />
      )}
      <div className="absolute flex h-full w-full items-center justify-center bg-white bg-opacity-50">
        <h1>{title}</h1>
      </div>
    </div>
  )
}
