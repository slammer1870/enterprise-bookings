'use client'

import React from 'react'
import Image from 'next/image'

type ImageLike =
  | {
      url?: string
      alt?: string
    }
  | number
  | string

function getImageUrl(image: ImageLike | undefined | null): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (typeof image === 'object' && image?.url) return image.url
  return null
}

type MissionItem = {
  icon?: ImageLike | null
  title: string
  description: string
}

export const MissionElementsBlock: React.FC<{
  sectionTitle: string
  sectionSubtitle?: string | null
  items: MissionItem[]
  disableInnerContainer?: boolean
}> = ({ sectionTitle, sectionSubtitle, items, disableInnerContainer }) => {
  const content = (
    <>
      <div className="text-center">
        <h2 className="text-3xl font-bold">{sectionTitle}</h2>
        {sectionSubtitle ? (
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">{sectionSubtitle}</p>
        ) : null}
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(items ?? []).map((item, idx) => {
          const iconUrl = getImageUrl(item.icon)
          return (
            <div key={idx} className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
              {iconUrl ? (
                <div className="mb-4 flex justify-center">
                  <div className="relative h-14 w-14 overflow-hidden rounded-md">
                    <Image src={iconUrl} alt={item.title} fill sizes="56px" className="object-cover" />
                  </div>
                </div>
              ) : null}
              <h3 className="text-xl font-semibold text-center">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-center">{item.description}</p>
            </div>
          )
        })}
      </div>
    </>
  )

  if (disableInnerContainer) {
    return (
      <section className="w-full py-12">
        <div className="max-w-6xl mx-auto px-8">{content}</div>
      </section>
    )
  }

  return (
    <section className="container py-12">
      <div className="max-w-6xl mx-auto px-8">{content}</div>
    </section>
  )
}
