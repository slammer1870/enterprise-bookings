import React from 'react'
import type { CaseStudiesBlock as CaseStudiesBlockProps } from '@/payload-types'
import RichText from '@/components/RichText'
import { Media } from '@/components/Media'
import { CMSLink } from '@/components/Link'
import { cn } from '@/utilities/ui'

type Props = {
  className?: string
  disableInnerContainer?: boolean
} & CaseStudiesBlockProps

export const CaseStudiesBlock: React.FC<Props> = ({
  heading,
  description,
  caseStudies,
  layout = 'grid',
  backgroundColor = 'default',
  className,
  disableInnerContainer,
}) => {
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
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">{heading}</h2>
            )}
            {description && (
              <div className="text-lg text-muted-foreground">
                <RichText data={description} enableGutter={false} enableProse={false} />
              </div>
            )}
          </div>
        )}

        {caseStudies && caseStudies.length > 0 && (
          <div
            className={cn(
              layout === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-8' : 'flex flex-col gap-8',
            )}
          >
            {caseStudies.map((study, index) => (
              <div
                key={index}
                className="flex flex-col gap-6 p-8 rounded-lg border border-border bg-card hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center gap-4">
                  {/* Company Logo */}
                  {study.companyLogo && typeof study.companyLogo === 'object' && (
                    <div className="w-24 h-12 mb-2 opacity-80">
                      <Media
                        resource={study.companyLogo}
                        imgClassName="w-full h-full object-contain object-left"
                      />
                    </div>
                  )}
                  {/* Quote */}
                  {study.quote && (
                    <blockquote className="text-xl md:text-2xl font-medium leading-relaxed">
                      "{study.quote}"
                    </blockquote>
                  )}{' '}
                </div>

                {/* Author */}
                {study.author && (
                  <div className="flex items-center gap-4 pt-4 border-t border-border">
                    {study.author.avatar && typeof study.author.avatar === 'object' && (
                      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                        <Media
                          resource={study.author.avatar}
                          imgClassName="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div>
                      {study.author.name && (
                        <div className="font-semibold">{study.author.name}</div>
                      )}
                      {study.author.title && (
                        <div className="text-sm text-muted-foreground">{study.author.title}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Results */}
                {study.results && study.results.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    {study.results.map((result, resultIndex) => (
                      <div key={resultIndex} className="text-center">
                        {result.metric && (
                          <div className="text-2xl font-bold text-primary">{result.metric}</div>
                        )}
                        {result.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {result.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Link */}
                {study.link && (
                  <div className="mt-auto pt-4">
                    <CMSLink
                      type={study.link.type || undefined}
                      reference={
                        study.link.reference
                          ? {
                              relationTo: 'pages',
                              value: study.link.reference as any,
                            }
                          : undefined
                      }
                      url={study.link.url || undefined}
                      label={study.link.label || 'Read full case study'}
                      newTab={study.link.newTab || false}
                      appearance="inline"
                      className="text-primary hover:underline font-medium"
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
