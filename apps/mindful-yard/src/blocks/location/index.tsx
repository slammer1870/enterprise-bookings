import { Media } from '@/payload-types'
import Image from 'next/image'
import Link from 'next/link'

interface LocationBlockProps {
  image: Media
  location_group: {
    location_text: string
    location_link: string
  }
}

export const LocationBlock = (props: LocationBlockProps) => {
  const { image, location_group } = props

  const { location_text, location_link } = location_group

  return (
    <div className="max-w-screen-sm mx-auto flex flex-col gap-4 p-6" id="location">
      <h2 className="text-2xl font-medium text-center">Location</h2>
      <Image
        src={image.url || ''}
        alt={image.alt || ''}
        width={image.width || 0}
        height={image.height || 0}
        className="object-cover aspect-video relative"
      />
      <h3 className="text-xl font-medium -mb-2">Address</h3>
      <Link href={location_link || ''} target="_blank">
        <p className="text-sm text-blue-500 underline">{location_text}</p>
      </Link>
    </div>
  )
}

export default LocationBlock
