'use client'

import React, { useEffect, useState } from 'react'

import { extractGoogleMapsPlaceName } from '@/utilities/extractGoogleMapsPlaceName'
import { normalizeGoogleMapsEmbedUrl } from '@/utilities/normalizeGoogleMapsEmbedUrl'

export type MapBlockProps = {
  mapUrl?: string | null
  caption?: string | null
  /** Pre-resolved embed src (e.g. from server). Skips client normalize when set. */
  embedSrc?: string | null
  /** Pre-resolved business / place name from the maps URL. */
  placeName?: string | null
  /** @deprecated older lexical embeds */
  address?: string | null
  blockType?: 'map'
  className?: string
}

function isShortMapsLink(url: string): boolean {
  return url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')
}

export function MapBlock({
  mapUrl,
  caption,
  embedSrc: embedSrcProp,
  placeName: placeNameProp,
  address,
  className,
}: MapBlockProps) {
  const pasted = (mapUrl || address || '').trim()
  const initialPlace =
    (typeof placeNameProp === 'string' && placeNameProp.trim()) ||
    extractGoogleMapsPlaceName(pasted) ||
    null

  const [src, setSrc] = useState<string | null>(() => {
    if (typeof embedSrcProp === 'string' && embedSrcProp.trim()) return embedSrcProp.trim()
    if (pasted && !isShortMapsLink(pasted)) return normalizeGoogleMapsEmbedUrl(pasted)
    return null
  })
  const [resolvedPlaceName, setResolvedPlaceName] = useState<string | null>(initialPlace)

  useEffect(() => {
    const propSrc = typeof embedSrcProp === 'string' ? embedSrcProp.trim() : ''
    const propPlace = typeof placeNameProp === 'string' ? placeNameProp.trim() : ''

    if (propSrc) {
      setSrc(propSrc)
      setResolvedPlaceName(propPlace || extractGoogleMapsPlaceName(pasted) || null)
      return
    }

    if (!pasted) {
      setSrc(null)
      setResolvedPlaceName(null)
      return
    }

    if (!isShortMapsLink(pasted)) {
      setSrc(normalizeGoogleMapsEmbedUrl(pasted))
      setResolvedPlaceName(propPlace || extractGoogleMapsPlaceName(pasted) || null)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/maps/resolve-embed?url=${encodeURIComponent(pasted)}`,
        )
        const data = (await res.json()) as {
          embedSrc?: string | null
          placeName?: string | null
        }
        if (!cancelled) {
          setSrc(data.embedSrc || normalizeGoogleMapsEmbedUrl(pasted))
          setResolvedPlaceName(
            propPlace || data.placeName || extractGoogleMapsPlaceName(pasted) || null,
          )
        }
      } catch {
        if (!cancelled) {
          setSrc(normalizeGoogleMapsEmbedUrl(pasted))
          setResolvedPlaceName(propPlace || extractGoogleMapsPlaceName(pasted) || null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pasted, embedSrcProp, placeNameProp])

  const label = (caption || resolvedPlaceName || '').trim()

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
