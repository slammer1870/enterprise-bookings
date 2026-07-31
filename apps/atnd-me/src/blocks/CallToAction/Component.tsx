import React from 'react'

import type { CallToActionBlock as CTABlockProps } from '@/payload-types'

import ClientRichText from '@/components/RichText/Client'
import { CMSButton } from '@repo/website'

export const CallToActionBlock: React.FC<CTABlockProps> = ({ links, richText }) => {
  return (
    <div className="w-full">
      <div className="bg-card rounded border-border border p-4 flex flex-col gap-8 md:flex-row md:justify-between md:items-center">
        <div className="max-w-[48rem] flex items-center">
          {richText && <ClientRichText className="mb-0" data={richText} enableGutter={false} />}
        </div>
        <div className="flex flex-col gap-8">
          {(links || []).map(({ link }, i) => {
            if (!link) return null
            return <CMSButton key={i} size="lg" {...link} />
          })}
        </div>
      </div>
    </div>
  )
}
