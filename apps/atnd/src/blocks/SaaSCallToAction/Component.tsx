import React from 'react'
import type { SaaSCallToActionBlock as SaaSCallToActionBlockProps } from '@/payload-types'
import RichText from '@/components/RichText'
import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { cn } from '@/utilities/ui'

type Props = {
  className?: string
  disableInnerContainer?: boolean
} & SaaSCallToActionBlockProps

export const SaaSCallToActionBlock: React.FC<Props> = ({
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

  return (
    <section
      className={cn('py-24 md:py-32 relative overflow-hidden', className)}
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
        className={cn({
          container: !disableInnerContainer,
        })}
      >
        <div
          className={cn(
            'relative z-10 p-12 md:p-16 rounded-2xl',
            variantClasses[variant],
            'flex flex-col gap-6 max-w-4xl',
            alignmentClasses[alignment],
            alignment === 'center' && 'mx-auto'
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
                'text-lg',
                variant === 'highlighted' ? 'text-primary-foreground/90' : 'text-muted-foreground'
              )}
            >
              <RichText data={description} enableGutter={false} enableProse={false} />
            </div>
          )}

          {links && links.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              {links.map(({ link }, i) => (
                <CMSLink
                  key={i}
                  size="lg"
                  {...link}
                  appearance={
                    variant === 'highlighted'
                      ? i === 0
                        ? 'outline'
                        : 'default'
                      : i === 0
                        ? 'default'
                        : 'outline'
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

