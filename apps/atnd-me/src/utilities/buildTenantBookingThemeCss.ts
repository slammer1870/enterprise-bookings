import {
  BOOKING_THEME_CSS_VARS,
  BOOKING_THEME_STATE_KEYS,
  type TenantBookingTheme,
} from '@/utilities/bookingThemeTypes'
import { resolveTailwindColorToken } from '@/utilities/tailwindColorTokens'

/**
 * Builds CSS that overrides booking button tokens for a tenant.
 * Returns null when no colors are configured (platform defaults apply).
 *
 * Selectors include dark-mode variants so one tenant palette applies in both themes.
 */
export function buildTenantBookingThemeCss(
  bookingTheme: TenantBookingTheme | null | undefined,
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

  return `:root,\n.dark,\n[data-theme='dark'] {\n${declarations.join('\n')}\n}`
}
