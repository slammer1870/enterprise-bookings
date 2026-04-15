'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type MediaLike =
  | number
  | string
  | null
  | undefined
  | {
      url?: string | null
      updatedAt?: string | null
      alt?: string | null
    }

function resolveMediaUrl(media: MediaLike): string | undefined {
  if (media == null) return undefined
  if (typeof media === 'string') return media
  if (typeof media === 'number') return undefined

  const url = media.url
  if (url && typeof url === 'string') return url

  return undefined
}

function splitTitleForAccent(title: string) {
  const accentWord = 'Benefits'
  if (!title.includes(accentWord)) return { before: title, accent: '' }
  const [before, after] = title.split(accentWord)
  return { before: `${before}`, accent: accentWord, after }
}

function BenefitIcon() {
  return (
    <div className="flex items-center justify-center rounded-md border border-[#d4a373]/50 bg-[#1a110e]/40 p-2">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2s7 4.5 7 11a7 7 0 0 1-14 0C5 6.5 12 2 12 2Z"
          stroke="#d4a373"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 13.2c.7.9 1.5 1.4 2.5 1.4 2 0 3.4-1.7 3.4-4.1"
          stroke="#d4a373"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export const ClSaunaBenefitsBlock: React.FC<{
  sectionTitle: string
  items?: Array<{ title: string; description: string }> | null
  backgroundImage?: MediaLike
  tagline?: string | null
}> = ({ sectionTitle, items, backgroundImage, tagline }) => {
  const list = items?.filter((i) => i?.title && i?.description) ?? []
  const bgUrl = resolveMediaUrl(backgroundImage)

  const { before, accent } = useMemo(() => splitTitleForAccent(sectionTitle), [sectionTitle])

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    if (list.length <= 1) {
      setActiveIndex(0)
      return
    }

    const update = () => {
      const first = viewport.querySelector<HTMLElement>('[data-slide="true"]')
      if (!first) return

      const slideWidth = first.offsetWidth || 1
      const next = Math.round(viewport.scrollLeft / slideWidth)
      setActiveIndex(Math.max(0, Math.min(next, list.length - 1)))
    }

    update()
    viewport.addEventListener('scroll', update, { passive: true })
    return () => viewport.removeEventListener('scroll', update)
  }, [list.length])

  const scrollToIndex = (idx: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const first = viewport.querySelector<HTMLElement>('[data-slide="true"]')
    const slideWidth = first?.offsetWidth || 1
    viewport.scrollTo({ left: slideWidth * idx, behavior: 'smooth' })
  }

  return (
    <section className="w-full py-14 md:py-20">
      <div className="relative">
        {bgUrl ? (
          <Image
            src={bgUrl}
            alt={typeof backgroundImage === 'object' && backgroundImage?.alt ? backgroundImage.alt : ''}
            fill
            priority
            className="object-cover"
          />
        ) : null}

        <div
          className="absolute inset-0 bg-stone-950/70"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.9) 100%)',
          }}
          aria-hidden
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 md:px-6">
          {(tagline || sectionTitle) && (
            <div className="text-center">
              {tagline ? <div className="text-[0.72rem] tracking-[0.18em] text-[#d4a373]/90">{tagline}</div> : null}
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                {before}
                {accent ? <span className="text-[#d4a373]">{accent}</span> : null}
              </h2>
            </div>
          )}

          {list.length > 0 ? (
            <div className="mt-12">
              {/* Scroll-snap carousel to match croilan.com layout */}
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between md:flex">
                  <button
                    type="button"
                    className="pointer-events-auto rounded-full border border-white/20 bg-stone-950/30 p-2 text-white shadow-sm hover:bg-stone-950/50 disabled:opacity-30"
                    aria-label="Previous"
                    disabled={activeIndex === 0}
                    onClick={() => scrollToIndex(activeIndex - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="pointer-events-auto rounded-full border border-white/20 bg-stone-950/30 p-2 text-white shadow-sm hover:bg-stone-950/50 disabled:opacity-30"
                    aria-label="Next"
                    disabled={activeIndex >= list.length - 1}
                    onClick={() => scrollToIndex(activeIndex + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div
                  ref={viewportRef}
                  className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {list.map((item, idx) => (
                    <div
                      key={idx}
                      data-slide="true"
                      className="snap-start shrink-0 w-[85%] md:w-[50%] lg:w-[23%]"
                    >
                      <div className="h-full rounded-xl border border-white/10 bg-stone-950/30 p-6 shadow-sm md:p-7">
                        <div className="flex items-start gap-4">
                          <BenefitIcon />
                          <div>
                            <h3 className="text-base font-semibold text-white md:text-lg">{item.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-white/70">{item.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {list.length > 1 ? (
                <div className="mt-7 flex items-center justify-center gap-2">
                  {list.map((_, i) => {
                    const isActive = i === activeIndex
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Go to slide ${i + 1}`}
                        className={[
                          'h-2.5 w-2.5 rounded-full transition-colors',
                          isActive ? 'bg-[#d4a373]' : 'bg-white/25 hover:bg-white/35',
                        ].join(' ')}
                        onClick={() => scrollToIndex(i)}
                      />
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
