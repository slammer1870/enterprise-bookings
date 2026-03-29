'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { cn } from '@repo/ui/lib/utils'
import { getLinkHref } from '../../utils/getLinkHref'
import { Carousel } from './Carousel.client'

type MediaResource = { url?: string; alt?: string } | number | string

interface CaseStudyItem {
  companyName?: string
  companyLogo?: MediaResource
  quote?: string
  author?: {
    name?: string
    title?: string
    avatar?: MediaResource
  }
  results?: Array<{ metric?: string; description?: string }>
  link?: {
    type?: 'reference' | 'custom'
    url?: string
    label?: string
    newTab?: boolean
    reference?: { value: string | number | { slug?: string }; relationTo: string }
  }
}

interface CaseStudiesBlockProps {
  heading?: string
  description?: SerializedEditorState
  caseStudies?: CaseStudyItem[]
  layout?: 'grid' | 'carousel'
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

function CaseStudyCard({ study }: { study: CaseStudyItem }) {
  return (
    <div className="flex flex-col gap-6 p-8 rounded-lg border border-border bg-card hover:shadow-xl transition-shadow">
      <div className="flex items-center gap-4">
        {study.companyLogo && mediaUrl(study.companyLogo) && (
          <div className="w-24 h-12 relative opacity-80 flex-shrink-0">
            <Image
              src={mediaUrl(study.companyLogo)!}
              alt={study.companyName ?? ''}
              fill
              className="object-contain object-left"
            />
          </div>
        )}
        {study.quote && (
          <blockquote className="text-xl md:text-2xl font-medium leading-relaxed">
            &ldquo;{study.quote}&rdquo;
          </blockquote>
        )}
      </div>

      {study.author && (
        <div className="flex items-center gap-4 pt-4 border-t border-border">
          {study.author.avatar && mediaUrl(study.author.avatar) && (
            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 relative">
              <Image
                src={mediaUrl(study.author.avatar)!}
                alt=""
                fill
                className="object-cover"
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

      {study.results && study.results.length > 0 && (
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          {study.results.map((result, i) => (
            <div key={i} className="text-center">
              {result.metric && (
                <div className="text-lg font-bold text-primary">{result.metric}</div>
              )}
              {result.description && (
                <div className="text-sm text-muted-foreground mt-1">{result.description}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {study.link && (study.link.reference || study.link.url) && (
        <div className="mt-auto pt-4">
          <Link
            href={getLinkHref(study.link)}
            {...(study.link.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="text-primary hover:underline font-medium"
          >
            {study.link.label ?? 'Read full case study'}
          </Link>
        </div>
      )}
    </div>
  )
}

export const CaseStudiesBlock: React.FC<CaseStudiesBlockProps> = ({
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

  if (!caseStudies?.length) {
    return null
  }

  return (
    <section
      className={cn(
        'py-24 md:py-32',
        bgColorClasses[backgroundColor ?? 'default'],
        className,
      )}
    >
      <div
        className={cn(
          disableInnerContainer ? 'px-4 md:px-6 lg:px-8' : 'container',
        )}
      >
        {(heading || description) && (
          <div className="text-center max-w-3xl mx-auto mb-16">
            {heading && (
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">{heading}</h2>
            )}
            {description && (
              <div className="text-lg text-muted-foreground [&_.rich-text]:!mb-0">
                <RichText data={description} />
              </div>
            )}
          </div>
        )}

        {layout === 'carousel' ? (
          <>
            <div className="flex flex-col gap-8 md:hidden">
              {caseStudies.map((study, index) => (
                <CaseStudyCard key={index} study={study} />
              ))}
            </div>
            <Carousel className="hidden md:block" viewportClassName="px-1 py-1">
              {caseStudies.map((study, index) => (
                <div
                  key={index}
                  className={cn(
                    'snap-start shrink-0',
                    'w-[85%] lg:w-[60%] xl:w-[48%]',
                  )}
                >
                  <CaseStudyCard study={study} />
                </div>
              ))}
            </Carousel>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {caseStudies.map((study, index) => (
              <CaseStudyCard key={index} study={study} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
