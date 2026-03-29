'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { Button } from '@repo/ui/components/ui/button'
import { cn } from '@repo/ui/lib/utils'
import { getLinkHref } from '../../utils/getLinkHref'

type MediaResource = { url?: string; alt?: string } | number | string

interface MarketingCtaBlockProps {
  heading?: string
  description?: SerializedEditorState
  links?: Array<{ link: { type?: 'reference' | 'custom'; url?: string; label?: string; appearance?: 'default' | 'outline'; newTab?: boolean; reference?: { value: string | number | { slug?: string }; relationTo: string } } }>
  backgroundMedia?: MediaResource
  variant?: 'default' | 'highlighted' | 'bordered'
  alignment?: 'left' | 'center' | 'right'
  className?: string
  disableInnerContainer?: boolean
}

function mediaUrl(resource: MediaResource | undefined): string | null {
  if (!resource) return null
  if (typeof resource === 'object' && resource?.url) return resource.url
  if (typeof resource === 'string') return resource
  return null
}

export const MarketingCtaBlock: React.FC<MarketingCtaBlockProps> = ({
  heading,
  description,
  links,
  backgroundMedia,
  variant = 'default',
  alignment = 'center',
  className,
  disableInnerContainer,
}) => {
  const alignmentClasses = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  }

  const variantClasses = {
    default: 'bg-card',
    highlighted: 'bg-primary text-primary-foreground',
    bordered: 'bg-card border-2 border-primary',
  }

  const bgUrl = mediaUrl(backgroundMedia)

  return (
    <section className={cn('py-24 md:py-32 relative overflow-hidden', className)}>
      {bgUrl && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <Image
            src={bgUrl}
            alt=""
            fill
            className="object-cover opacity-10"
            sizes="100vw"
          />
        </div>
      )}

      <div
        className={cn(
          disableInnerContainer ? 'px-4 md:px-6 lg:px-8' : 'container',
        )}
      >
        <div
          className={cn(
            'relative z-10 p-12 md:p-16 rounded-2xl',
            variantClasses[variant ?? 'default'],
            'flex flex-col gap-6 max-w-4xl',
            alignmentClasses[alignment ?? 'center'],
            (alignment ?? 'center') === 'center' && 'mx-auto',
          )}
        >
          {heading && (
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
              {heading}
            </h2>
          )}

          {description && (
            <div
              className={cn(
                'text-lg [&_.rich-text]:!mb-0',
                (variant ?? 'default') === 'highlighted'
                  ? 'text-primary-foreground/90'
                  : 'text-muted-foreground',
              )}
            >
              <RichText data={description} />
            </div>
          )}

          {links && links.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              {links.map(({ link }, i) => {
                const href = getLinkHref(link)
                const appearance =
                  (variant ?? 'default') === 'highlighted'
                    ? i === 0
                      ? 'outline'
                      : 'default'
                    : i === 0
                      ? 'default'
                      : 'outline'
                return (
                  <Button
                    key={i}
                    asChild
                    variant={appearance === 'outline' ? 'outline' : 'default'}
                    size="lg"
                    className={
                      (variant ?? 'default') === 'highlighted' && appearance === 'outline'
                        ? 'border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary'
                        : undefined
                    }
                  >
                    <Link
                      href={href}
                      {...(link?.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {link?.label ?? 'Learn more'}
                    </Link>
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
