'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { cn } from '@repo/ui/lib/utils'
import { getLinkHref } from '../../utils/getLinkHref'

type MediaResource = { url?: string; alt?: string } | number | string

interface FeatureItem {
  title?: string
  description?: string
  icon?: MediaResource
  link?: {
    type?: 'reference' | 'custom'
    url?: string
    label?: string
    newTab?: boolean
    reference?: { value: string | number | { slug?: string }; relationTo: string }
  }
}

interface FeaturesBlockProps {
  heading?: string
  description?: SerializedEditorState
  features?: FeatureItem[]
  columns?: '2' | '3' | '4'
  backgroundColor?: 'default' | 'subtle' | 'muted'
  className?: string
  disableInnerContainer?: boolean
}

function mediaUrl(resource: MediaResource | undefined): string | null {
  if (!resource) return null
  if (typeof resource === 'object' && resource?.url) return resource.url
  if (typeof resource === 'string') return resource
  return null
}

export const FeaturesBlock: React.FC<FeaturesBlockProps> = ({
  heading,
  description,
  features,
  columns = '3',
  backgroundColor = 'default',
  className,
  disableInnerContainer,
}) => {
  const columnClasses = {
    '2': 'grid-cols-1 md:grid-cols-2',
    '3': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    '4': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }

  const bgColorClasses = {
    default: 'bg-background',
    subtle: 'bg-muted/30',
    muted: 'bg-muted/50',
  }

  return (
    <section
      className={cn('py-24 md:py-32', bgColorClasses[backgroundColor ?? 'default'], className)}
    >
      <div
        className={cn(
          disableInnerContainer ? 'px-4 md:px-6 lg:px-8' : 'container',
        )}
      >
        {(heading || description) && (
          <div className="text-center max-w-3xl mx-auto mb-16">
            {heading && (
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
                {heading}
              </h2>
            )}
            {description && (
              <div className="text-lg text-muted-foreground [&_.rich-text]:!mb-0">
                <RichText data={description} />
              </div>
            )}
          </div>
        )}

        {features && features.length > 0 && (
          <div
            className={cn(
              'grid gap-8 lg:gap-12',
              columnClasses[columns as keyof typeof columnClasses],
            )}
          >
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex flex-col gap-4 p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow"
              >
                {feature.icon && mediaUrl(feature.icon) && (
                  <div className="w-12 h-12 mb-2 relative">
                    <Image
                      src={mediaUrl(feature.icon)!}
                      alt=""
                      width={48}
                      height={48}
                      className="object-contain"
                    />
                  </div>
                )}

                {feature.title && (
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                )}

                {feature.description && (
                  <p className="text-muted-foreground flex-grow">{feature.description}</p>
                )}

                {feature.link && (feature.link.reference || feature.link.url) && (
                  <div className="mt-auto pt-4">
                    <Link
                      href={getLinkHref(feature.link)}
                      {...(feature.link.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      {feature.link.label ?? 'Learn more'}
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
