'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

type MediaLike =
  | { url?: string | null; alt?: string | null; updatedAt?: string | null }
  | string
  | number
  | null
  | undefined

function resolveUrl(media: MediaLike): string | undefined {
  if (!media || typeof media === 'number') return undefined
  if (typeof media === 'string') return media
  const { url, updatedAt } = media
  if (!url) return undefined
  if (updatedAt) {
    const q = encodeURIComponent(updatedAt)
    return url.includes('?') ? `${url}&${q}` : `${url}?${q}`
  }
  return url
}

function resolveAlt(media: MediaLike): string {
  if (!media || typeof media !== 'object' || typeof media === 'number') return ''
  return ('alt' in media && typeof media.alt === 'string' ? media.alt : '') || ''
}

type LinkReference = {
  value: string | number | { slug?: string }
  relationTo: string
}

type CmsLink = {
  type?: 'reference' | 'custom' | null
  newTab?: boolean | null
  reference?: LinkReference | null
  url?: string | null
}

export type HwService = {
  icon?: MediaLike
  label: string
  link?: CmsLink | null
}

function resolveLink(cmsLink?: CmsLink | null): { href: string; newTab: boolean } {
  if (!cmsLink) return { href: '#', newTab: false }
  const newTab = cmsLink.newTab ?? false
  if (cmsLink.type === 'reference' && cmsLink.reference) {
    const ref = cmsLink.reference.value
    const slug = typeof ref === 'object' && ref?.slug ? ref.slug : ''
    const href = cmsLink.reference.relationTo !== 'pages' ? `/${cmsLink.reference.relationTo}/${slug}` : `/${slug}`
    return { href: href || '#', newTab }
  }
  return { href: cmsLink.url?.trim() || '#', newTab }
}

export type HwHeroServicesBlockProps = {
  logo?: MediaLike
  services?: HwService[] | null
}

export const HwHeroServicesBlock: React.FC<HwHeroServicesBlockProps> = ({ logo, services }) => {
  const logoUrl = resolveUrl(logo)
  const items = services ?? []

  const logoImage = logoUrl ? (
    <Image
      src={logoUrl}
      alt={resolveAlt(logo)}
      width={720}
      height={472}
      className="h-auto w-full max-h-[75vh] object-contain md:max-h-[80vh] xl:max-h-[65vh]"
      priority
      sizes="(min-width: 1280px) 33vw, (min-width: 768px) 66vw, 100vw"
    />
  ) : null

  return (
    <section className="flex min-h-screen w-full flex-col items-center justify-around gap-10 bg-white py-20 md:gap-0 md:py-0 xl:flex-row xl:items-center xl:justify-around">
      {/* ── Logo: mobile (2/3 width, centered) ─────────────────────── */}
      {logoUrl && (
        <div className="flex w-full flex-none items-center justify-center md:hidden">
          <Image
            src={logoUrl}
            alt={resolveAlt(logo)}
            width={400}
            height={260}
            className="h-auto w-full object-contain"
            priority
          />
        </div>
      )}

      {/* ── Logo: medium+ (centered in column / left in row) ─────────── */}
      {logoImage && (
        <div className="hidden w-2/3 items-center justify-center self-center md:flex md:flex-none xl:w-1/3 xl:shrink-0 xl:self-auto">
          {logoImage}
        </div>
      )}

      {/* ── Services pane ───────────────────────────────────────────── */}
      <div className="flex w-full flex-none flex-col justify-center xl:w-1/3 xl:shrink-0 xl:justify-center">
        {/* Mobile & large: single column */}
        <ul className="flex w-full flex-col gap-3 md:hidden xl:flex">
          {items.map((service, i) => (
            <ServiceRow key={i} service={service} />
          ))}
        </ul>

        {/* Medium only: 2-column grid */}
        <ul className="hidden md:grid xl:hidden grid-cols-2 gap-3">
          {items.map((service, i) => (
            <ServiceRow key={i} service={service} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function ServiceRow({ service }: { service: HwService }) {
  const iconUrl = resolveUrl(service.icon)
  const { href, newTab } = resolveLink(service.link)
  const hasLink = href !== '#'

  const inner = (
    <div className="flex items-center gap-4 rounded-lg bg-gray-100 px-4 py-3 transition-colors hover:bg-gray-200">
      {iconUrl ? (
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md">
          <Image
            src={iconUrl}
            alt={resolveAlt(service.icon)}
            fill
            sizes="44px"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="h-11 w-11 shrink-0 rounded-md bg-gray-300" />
      )}
      <span className="flex-1 text-sm font-medium text-gray-900 md:text-base">{service.label}</span>
      <span className="text-gray-500 text-base" aria-hidden>
        →
      </span>
    </div>
  )

  return (
    <li>
      {hasLink ? (
        <Link href={href} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}>
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  )
}
