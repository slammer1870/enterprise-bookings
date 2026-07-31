/**
 * Re-export shared colour helpers from @repo/website for booking-theme consumers.
 */
export {
  COLOR_OPTIONS as TAILWIND_COLOR_OPTIONS,
  COLOR_PRESETS as BOOKING_COLOR_PRESETS,
  normalizeHexForColorInput,
  resolveColorToken as resolveTailwindColorToken,
  type ColorPresetOption as TailwindColorOption,
} from '@repo/website/src/admin/colorTokens'
