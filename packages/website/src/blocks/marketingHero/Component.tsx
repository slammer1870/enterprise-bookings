import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { Button } from '@repo/ui/components/ui/button'
import { cn } from '@repo/ui/lib/utils'
import { getLinkHref } from '../../utils/getLinkHref'

type MediaResource = { url?: string; alt?: string } | number | string

interface MarketingHeroBlockProps {
  headline?: string
  subheadline?: SerializedEditorState
  links?: Array<{ link: { type?: 'reference' | 'custom'; url?: string; label?: string; appearance?: 'default' | 'outline'; newTab?: boolean; reference?: { value: string | number | { slug?: string }; relationTo: string } } }>
  backgroundMedia?: MediaResource
  foregroundMedia?: MediaResource
  alignment?: 'left' | 'center' | 'right'
  backgroundColor?: 'default' | 'subtle' | 'muted'
  className?: string
}

function mediaUrl(resource: MediaResource | undefined): string | null {
  if (!resource) return null
  if (typeof resource === 'object' && resource?.url) return resource.url
  if (typeof resource === 'string') return resource
  return null
}

export const MarketingHeroBlock: React.FC<MarketingHeroBlockProps> = ({
  headline,
  subheadline,
  links,
  backgroundMedia,
  foregroundMedia,
  alignment = 'center',
  backgroundColor = 'default',
  className,
}) => {
  const alignmentClasses = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  }

  const bgColorClasses = {
    default: 'bg-background',
    subtle: 'bg-muted/30',
    muted: 'bg-muted/50',
  }

  const bgUrl = mediaUrl(backgroundMedia)
  const fgUrl = mediaUrl(foregroundMedia)

  return (
    <section
      className={cn(
        'relative overflow-hidden lg:min-h-screen pt-24',
        bgColorClasses[backgroundColor ?? 'default'],
        className,
      )}
    >
      {bgUrl && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <Image
            src={bgUrl}
            alt=""
            fill
            className="object-cover opacity-10"
            sizes="100vw"
            loading="lazy"
          />
        </div>
      )}

      <div className="container relative z-10">
        <div
          className={cn(
            'flex flex-col gap-8 max-w-4xl',
            alignmentClasses[alignment ?? 'center'],
            (alignment ?? 'center') === 'center' && 'mx-auto',
          )}
        >
          {headline && (
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              {headline}
            </h1>
          )}

          {subheadline && (
            <div className="text-lg md:text-xl text-muted-foreground max-w-2xl [&_.rich-text]:!mb-0">
              <RichText data={subheadline} />
            </div>
          )}

          {links && links.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-4">
              {links.map(({ link }, i) => {
                const href = getLinkHref(link)
                const appearance = link?.appearance ?? (i === 0 ? 'default' : 'outline')
                return (
                  <Button key={i} asChild variant={appearance === 'outline' ? 'outline' : 'default'} size="lg">
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

          {fgUrl && (
            <div className="w-full relative aspect-video">
              <Image
                src={fgUrl}
                alt=""
                fill
                priority
                fetchPriority="high"
                className="object-contain rounded-lg border border-border shadow-2xl"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1024px"
                quality={75}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
