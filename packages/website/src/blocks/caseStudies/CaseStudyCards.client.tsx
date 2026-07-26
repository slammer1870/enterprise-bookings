'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { Button } from '@repo/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog'
import { cn } from '@repo/ui/lib/utils'

export type CaseStudyCardItem = {
  companyName?: string
  screenshotUrl?: string | null
  screenshotAlt?: string
  briefDescription?: SerializedEditorState | null
  detailedDescription?: SerializedEditorState | null
  websiteUrl?: string
  websiteLabel?: string
}

type CaseStudyCardsProps = {
  caseStudies: CaseStudyCardItem[]
}

export function CaseStudyCards({ caseStudies }: CaseStudyCardsProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const activeStudy = activeIndex !== null ? caseStudies[activeIndex] : null

  const gridCols =
    caseStudies.length === 1
      ? 'grid-cols-1'
      : caseStudies.length === 2
        ? 'grid-cols-1 md:grid-cols-2'
        : 'grid-cols-1 md:grid-cols-3'

  return (
    <>
      <div className={cn('grid gap-8', gridCols)}>
        {caseStudies.map((study, index) => (
          <button
            key={`${study.companyName ?? 'study'}-${index}`}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="group flex flex-col gap-4 rounded-lg border border-border bg-card p-5 text-left transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {study.screenshotUrl && (
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md bg-muted">
                <Image
                  src={study.screenshotUrl}
                  alt={study.screenshotAlt || study.companyName || 'Case study screenshot'}
                  fill
                  className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
            )}

            {study.companyName && (
              <h3 className="text-lg font-semibold">{study.companyName}</h3>
            )}

            {study.briefDescription && (
              <div className="text-sm leading-relaxed text-muted-foreground">
                <RichText
                  data={study.briefDescription}
                  className="prose prose-sm max-w-none text-muted-foreground prose-headings:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                />
                <span className="font-medium text-primary">Read more</span>
              </div>
            )}
          </button>
        ))}
      </div>

      <Dialog
        open={activeIndex !== null}
        onOpenChange={(open) => {
          if (!open) setActiveIndex(null)
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {activeStudy && (
            <>
              <DialogHeader>
                <DialogTitle>{activeStudy.companyName}</DialogTitle>
                <DialogDescription className="sr-only">
                  Case study details for {activeStudy.companyName}
                </DialogDescription>
              </DialogHeader>

              {activeStudy.screenshotUrl && (
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md bg-muted">
                  <Image
                    src={activeStudy.screenshotUrl}
                    alt={
                      activeStudy.screenshotAlt ||
                      activeStudy.companyName ||
                      'Case study screenshot'
                    }
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 48rem"
                  />
                </div>
              )}

              {activeStudy.detailedDescription && (
                <RichText
                  data={activeStudy.detailedDescription}
                  className="prose prose-sm max-w-none text-muted-foreground md:prose-base prose-headings:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                />
              )}

              {activeStudy.websiteUrl && (
                <DialogFooter>
                  <Button asChild>
                    <a
                      href={activeStudy.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {activeStudy.websiteLabel || 'Visit website'}
                    </a>
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
