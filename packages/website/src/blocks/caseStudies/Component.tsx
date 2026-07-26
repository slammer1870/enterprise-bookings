import React from 'react'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { cn } from '@repo/ui/lib/utils'
import { CaseStudyCards, type CaseStudyCardItem } from './CaseStudyCards.client'

type MediaResource = { url?: string; alt?: string } | number | string

interface CaseStudyItem {
  companyName?: string
  screenshot?: MediaResource
  briefDescription?: SerializedEditorState | null
  detailedDescription?: SerializedEditorState | null
  websiteUrl?: string
  websiteLabel?: string
}

interface CaseStudiesBlockProps {
  heading?: string
  description?: SerializedEditorState
  caseStudies?: CaseStudyItem[]
  backgroundColor?: 'default' | 'subtle' | 'muted'
  className?: string
}

function mediaUrl(resource: MediaResource | undefined): string | null {
  if (!resource) return null
  if (typeof resource === 'object' && resource?.url) return resource.url
  if (typeof resource === 'string') return resource
  return null
}

function mediaAlt(resource: MediaResource | undefined): string | undefined {
  if (resource && typeof resource === 'object' && 'alt' in resource) {
    return resource.alt
  }
  return undefined
}

export const CaseStudiesBlock: React.FC<CaseStudiesBlockProps> = ({
  heading,
  description,
  caseStudies,
  backgroundColor = 'default',
  className,
}) => {
  const bgColorClasses = {
    default: 'bg-background',
    subtle: 'bg-muted/30',
    muted: 'bg-muted/50',
  }

  if (!caseStudies?.length) {
    return null
  }

  const cards: CaseStudyCardItem[] = caseStudies.slice(0, 3).map((study) => ({
    companyName: study.companyName,
    screenshotUrl: mediaUrl(study.screenshot),
    screenshotAlt: mediaAlt(study.screenshot),
    briefDescription: study.briefDescription,
    detailedDescription: study.detailedDescription,
    websiteUrl: study.websiteUrl,
    websiteLabel: study.websiteLabel,
  }))

  return (
    <section
      className={cn(
        'py-12',
        bgColorClasses[backgroundColor ?? 'default'],
        className,
      )}
    >
      <div className="w-full">
        {(heading || description) && (
          <div className="mx-auto mb-16 max-w-3xl text-center">
            {heading && (
              <h2 className="mb-6 text-3xl font-bold md:text-4xl lg:text-5xl">{heading}</h2>
            )}
            {description && (
              <RichText
                data={description}
                className="prose prose-lg mx-auto max-w-none text-muted-foreground prose-headings:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              />
            )}
          </div>
        )}

        <CaseStudyCards caseStudies={cards} />
      </div>
    </section>
  )
}
