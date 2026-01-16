'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/utilities/ui'

type Props = {
  children: React.ReactNode
  className?: string
  viewportClassName?: string
}

export const Carousel: React.FC<Props> = ({ children, className, viewportClassName }) => {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = viewportRef.current
    if (!el) return

    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth)
    const epsilon = 2

    setCanScrollPrev(scrollLeft > epsilon)
    setCanScrollNext(scrollLeft < maxScrollLeft - epsilon)
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    updateScrollState()

    const onScroll = () => updateScrollState()
    el.addEventListener('scroll', onScroll, { passive: true })

    const ro = new ResizeObserver(() => updateScrollState())
    ro.observe(el)

    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [updateScrollState])

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const el = viewportRef.current
    if (!el) return

    const amount = Math.max(240, Math.floor(el.clientWidth * 0.9))
    el.scrollBy({ left: direction * amount, behavior: 'smooth' })
  }, [])

  const hasMultipleSlides = useMemo(() => {
    // This only needs to be good-enough to hide arrows when there is 0/1 child.
    return React.Children.count(children) > 1
  }, [children])

  return (
    <div className={cn('relative', className)}>
      {hasMultipleSlides && (
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between md:flex">
          <Button
            aria-label="Previous"
            className="pointer-events-auto -translate-x-3 shadow-sm"
            disabled={!canScrollPrev}
            onClick={() => scrollByPage(-1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            aria-label="Next"
            className="pointer-events-auto translate-x-3 shadow-sm"
            disabled={!canScrollNext}
            onClick={() => scrollByPage(1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div
        ref={viewportRef}
        className={cn(
          'flex gap-8 overflow-x-auto scroll-smooth snap-x snap-mandatory',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          viewportClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}


