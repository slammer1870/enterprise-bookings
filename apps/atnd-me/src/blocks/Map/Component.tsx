'use client'

import React, { useEffect, useState } from 'react'

import { normalizeGoogleMapsEmbedUrl } from '@/utilities/normalizeGoogleMapsEmbedUrl'

export type MapBlockProps = {
  mapUrl?: string | null
  caption?: string | null
  /** @deprecated older lexical embeds */
  address?: string | null
  placeName?: string | null
  blockType?: 'map'
  className?: string
}

function isShortMapsLink(url: string): boolean {
  return url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')
}

export function MapBlock({
  mapUrl,
  caption,
  address,
  placeName,
  className,
}: MapBlockProps) {
  const pasted = (mapUrl || address || '').trim()
  const [src, setSrc] = useState<string | null>(() =>
    pasted && !isShortMapsLink(pasted) ? normalizeGoogleMapsEmbedUrl(pasted) : null,
  )

  useEffect(() => {
    if (!pasted) {
      setSrc(null)
      return
    }

    if (!isShortMapsLink(pasted)) {
      setSrc(normalizeGoogleMapsEmbedUrl(pasted))
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/maps/resolve-embed?url=${encodeURIComponent(pasted)}`,
        )
        const data = (await res.json()) as { embedSrc?: string | null }
        if (!cancelled) {
          setSrc(data.embedSrc || normalizeGoogleMapsEmbedUrl(pasted))
        }
      } catch {
        if (!cancelled) setSrc(normalizeGoogleMapsEmbedUrl(pasted))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pasted])

  const label = (caption || placeName || '').trim()

  if (!src) {
    if (!pasted) return null
    return (
      <div
        className={
          className ??
          'my-8 flex aspect-[16/10] w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground sm:aspect-[21/9]'
        }
      >
        Loading map…
      </div>
    )
  }

  return (
    <figure className={className ?? 'my-8 not-prose w-full'}>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-muted sm:aspect-[21/9]">
        <iframe
          title={label || 'Map'}
          src={src}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      {label ? (
        <figcaption className="mt-3 text-center text-sm text-muted-foreground">{label}</figcaption>
      ) : null}
    </figure>
  )
}
