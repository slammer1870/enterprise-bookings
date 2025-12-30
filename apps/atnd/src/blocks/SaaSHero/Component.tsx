import React from 'react'
import type { SaaSHeroBlock as SaaSHeroBlockProps } from '@/payload-types'
import RichText from '@/components/RichText'
import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { cn } from '@/utilities/ui'

type Props = {
  className?: string
  disableInnerContainer?: boolean
} & SaaSHeroBlockProps

export const SaaSHeroBlock: React.FC<Props> = ({
  headline,
  subheadline,
  links,
  backgroundMedia,
  foregroundMedia,
  alignment = 'center',
  backgroundColor = 'default',
  className,
  disableInnerContainer,
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

  return (
    <section
      className={cn(
        'relative pt-12 md:pt-16 lg:pt-20 pb-24 md:pb-32 lg:pb-40 overflow-hidden',
        bgColorClasses[backgroundColor || 'default'],
        className
      )}
    >
      {backgroundMedia && typeof backgroundMedia === 'object' && (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <Media
            resource={backgroundMedia}
            pictureClassName="relative w-full h-full"
            imgClassName="object-cover opacity-10"
            fill
            htmlElement={null}
          />
        </div>
      )}
      
      <div
        className={cn(
          {
            container: !disableInnerContainer,
            'px-4 md:px-6 lg:px-8': disableInnerContainer,
          },
          'relative z-10'
        )}
      >
        <div
          className={cn(
            'flex flex-col gap-8 max-w-4xl',
            alignmentClasses[alignment || 'center'],
            (alignment || 'center') === 'center' && 'mx-auto'
          )}
        >
          {headline && (
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              {headline}
            </h1>
          )}
          
          {subheadline && (
            <div className="text-lg md:text-xl text-muted-foreground max-w-2xl">
              <RichText data={subheadline} enableGutter={false} enableProse={false} />
            </div>
          )}

          {links && links.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              {links.map(({ link }, i) => (
                <CMSLink
                  key={i}
                  size="lg"
                  {...link}
                  appearance={i === 0 ? 'default' : 'outline'}
                />
              ))}
            </div>
          )}

          {foregroundMedia && typeof foregroundMedia === 'object' && (
            <div className="mt-12 w-full">
              <Media
                resource={foregroundMedia}
                imgClassName="w-full rounded-lg border border-border shadow-2xl"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

