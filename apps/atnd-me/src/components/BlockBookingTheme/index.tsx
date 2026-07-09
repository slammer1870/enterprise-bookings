import React from 'react'

import { buildBookingThemeCss } from '@/utilities/buildBookingThemeCss'
import type { BookingThemeConfig } from '@/utilities/bookingThemeTypes'

type BlockBookingThemeProps = {
  bookingTheme?: BookingThemeConfig | null
  /** Stable block instance id from Payload (used to scope CSS variables). */
  scopeId?: string | null
  children: React.ReactNode
  className?: string
}

export function BlockBookingTheme({
  bookingTheme,
  scopeId,
  children,
  className,
}: BlockBookingThemeProps) {
  const selector = scopeId ? `[data-booking-theme="${scopeId}"]` : undefined
  const css = buildBookingThemeCss(bookingTheme, selector)

  if (!css && !className) {
    return <>{children}</>
  }

  return (
    <div {...(scopeId ? { 'data-booking-theme': scopeId } : {})} className={className}>
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {children}
    </div>
  )
}
