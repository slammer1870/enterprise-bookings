import React from 'react'
import Image from 'next/image'
import type { Media } from '@/payload-types'

interface OptimizedImageProps {
  media: Media
  alt?: string
  className?: string
  priority?: boolean
  sizes?: string
  fill?: boolean
  width?: number
  height?: number
  style?: React.CSSProperties
  quality?: number
}

/**
 * OptimizedImage component that automatically uses the best image size
 * from Payload CMS media collection based on the requested dimensions
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  media,
  alt,
  className,
  priority = false,
  sizes,
  fill = false,
  width,
  height,
  style,
  quality = 80,
}) => {
  // Use alt text from media or fallback to prop
  const imageAlt = alt || media.alt || ''
  
  // Function to select the best image size based on requested dimensions
  const selectOptimalImageSize = (requestedWidth?: number): string => {
    if (!requestedWidth) {
      return media.url || ''
    }

    // If we have sizes available, pick the most appropriate one
    // Note: sizes property may not be available in all Media types, so we use optional chaining
    const sizes = (media as any).sizes
    if (sizes) {
      if (requestedWidth <= 400 && sizes.thumbnail?.url) {
        return sizes.thumbnail.url
      } else if (requestedWidth <= 768 && sizes.card?.url) {
        return sizes.card.url
      } else if (requestedWidth <= 1024 && sizes.tablet?.url) {
        return sizes.tablet.url
      } else if (requestedWidth <= 1920 && sizes.desktop?.url) {
        return sizes.desktop.url
      }
    }

    // Fallback to original
    return media.url || ''
  }

  const imageSrc = selectOptimalImageSize(width)

  // Generate responsive sizes string if not provided
  const responsiveSizes = sizes || (() => {
    if (fill) {
      return '100vw'
    }
    if (width) {
      if (width <= 400) return '(max-width: 768px) 100vw, 400px'
      if (width <= 768) return '(max-width: 768px) 100vw, (max-width: 1024px) 768px, 768px'
      if (width <= 1024) return '(max-width: 768px) 100vw, (max-width: 1024px) 768px, 1024px'
      return '(max-width: 768px) 100vw, (max-width: 1024px) 768px, (max-width: 1920px) 1024px, 1920px'
    }
    return '(max-width: 768px) 100vw, (max-width: 1024px) 768px, 1024px'
  })()

  if (fill) {
    return (
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        className={className}
        priority={priority}
        sizes={responsiveSizes}
        style={style}
        quality={quality}
      />
    )
  }

  return (
    <Image
      src={imageSrc}
      alt={imageAlt}
      width={width || media.width || 800}
      height={height || media.height || 600}
      className={className}
      priority={priority}
      sizes={responsiveSizes}
      style={style}
      quality={quality}
    />
  )
}

export default OptimizedImage
