import React from 'react'
import type { FeaturesBlock as FeaturesBlockProps } from '@/payload-types'
import RichText from '@/components/RichText'
import { Media } from '@/components/Media'
import { CMSLink } from '@/components/Link'
import { cn } from '@/utilities/ui'

type Props = {
  className?: string
  disableInnerContainer?: boolean
} & FeaturesBlockProps

export const FeaturesBlock: React.FC<Props> = ({
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
      className={cn('py-24 md:py-32', bgColorClasses[backgroundColor || 'default'], className)}
    >
      <div
        className={cn({
          container: !disableInnerContainer,
          'px-4 md:px-6 lg:px-8': disableInnerContainer,
        })}
      >
        {(heading || description) && (
          <div className="text-center max-w-3xl mx-auto mb-16">
            {heading && (
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
                {heading}
              </h2>
            )}
            {description && (
              <div className="text-lg text-muted-foreground">
                <RichText data={description} enableGutter={false} enableProse={false} />
              </div>
            )}
          </div>
        )}

        {features && features.length > 0 && (
          <div className={cn('grid gap-8 lg:gap-12', columnClasses[columns as keyof typeof columnClasses])}>
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex flex-col gap-4 p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow"
              >
                {feature.icon && typeof feature.icon === 'object' && (
                  <div className="w-12 h-12 mb-2">
                    <Media
                      resource={feature.icon}
                      imgClassName="w-full h-full object-contain"
                    />
                  </div>
                )}
                
                {feature.title && (
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                )}
                
                {feature.description && (
                  <p className="text-muted-foreground flex-grow">{feature.description}</p>
                )}

                {feature.link && (
                  <div className="mt-auto pt-4">
                    <CMSLink
                      type={feature.link.type || undefined}
                      reference={
                        feature.link.reference
                          ? {
                              relationTo: 'pages',
                              value: feature.link.reference as any,
                            }
                          : undefined
                      }
                      url={feature.link.url || undefined}
                      label={feature.link.label || 'Learn more'}
                      newTab={feature.link.newTab || false}
                      appearance="inline"
                      className="text-primary hover:underline"
                    />
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

