import {
  BOOKING_THEME_CSS_VARS,
  BOOKING_THEME_STATE_KEYS,
  type BookingThemeConfig,
} from '@/utilities/bookingThemeTypes'
import { resolveTailwindColorToken } from '@/utilities/tailwindColorTokens'

const DEFAULT_SELECTORS = ":root,\n.dark,\n[data-theme='dark']"

/**
 * Builds CSS that overrides booking button tokens.
 * Returns null when no colors are configured (platform defaults apply).
 *
 * Pass a scoped selector (e.g. `[data-booking-theme="abc"]`) for per-block themes.
 */
export function buildBookingThemeCss(
  bookingTheme: BookingThemeConfig | null | undefined,
  selector: string = DEFAULT_SELECTORS,
): string | null {
  if (!bookingTheme) return null

  const declarations: string[] = []

  for (const key of BOOKING_THEME_STATE_KEYS) {
    const state = bookingTheme[key]
    const vars = BOOKING_THEME_CSS_VARS[key]

    const background = resolveTailwindColorToken(state?.backgroundColor)
    if (background) {
      declarations.push(`  ${vars.background}: ${background};`)
    }

    const foreground = resolveTailwindColorToken(state?.foregroundColor)
    if (foreground) {
      declarations.push(`  ${vars.foreground}: ${foreground};`)
    }
  }

  if (declarations.length === 0) return null

  return `${selector} {\n${declarations.join('\n')}\n}`
}

/** @deprecated Use buildBookingThemeCss */
export const buildTenantBookingThemeCss = buildBookingThemeCss
