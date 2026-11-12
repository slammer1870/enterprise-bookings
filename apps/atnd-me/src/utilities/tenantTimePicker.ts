import { TZDate } from '@date-fns/tz'

/**
 * Conversions for admin date/time pickers whose value means a wall clock at the
 * tenant (scheduler slots, timeslot date / start / end).
 *
 * The picker shows and returns dates in the browser's time zone, while the
 * server reads the stored instant's wall clock in the tenant's time zone. These
 * functions sit between the picker and the form value so the two agree.
 */

/**
 * The date to hand the picker for a stored time: the one whose wall clock in the
 * browser's time zone is the stored instant's wall clock at the tenant.
 */
export function tenantTimeToPickerDate(
  stored: Date | string | null | undefined,
  tenantTimeZone: string,
): Date | null {
  if (stored == null || stored === '') return null
  const instant = new Date(stored)
  if (Number.isNaN(instant.getTime())) return null

  const atTenant = new TZDate(instant, tenantTimeZone)
  return new Date(
    atTenant.getFullYear(),
    atTenant.getMonth(),
    atTenant.getDate(),
    atTenant.getHours(),
    atTenant.getMinutes(),
    atTenant.getSeconds(),
    atTenant.getMilliseconds(),
  )
}

/**
 * The value to store for a time picked in the browser: the instant whose wall
 * clock at the tenant is what the picker shows, so 4pm picked means 4pm at the
 * tenant whatever time zone the browser is in.
 */
export function pickedTimeToTenantTime(picked: Date, tenantTimeZone: string): string {
  const atTenant = new TZDate(
    picked.getFullYear(),
    picked.getMonth(),
    picked.getDate(),
    picked.getHours(),
    picked.getMinutes(),
    picked.getSeconds(),
    picked.getMilliseconds(),
    tenantTimeZone,
  )
  // Not `atTenant.toISOString()`: that carries the zone offset, and the scheduler
  // form compares these strings with the `Z` form the API returns.
  return new Date(atTenant.getTime()).toISOString()
}

/**
 * The date to hand a day picker for a stored timeslot date: the browser-local
 * calendar day that matches the stored instant's calendar day at the tenant.
 * Generated timeslots store midnight at the tenant, which is the previous
 * afternoon for an admin west of the tenant without this conversion.
 */
export function tenantDateToPickerDate(
  stored: Date | string | null | undefined,
  tenantTimeZone: string,
): Date | null {
  if (stored == null || stored === '') return null
  const instant = new Date(stored)
  if (Number.isNaN(instant.getTime())) return null

  const atTenant = new TZDate(instant, tenantTimeZone)
  return new Date(atTenant.getFullYear(), atTenant.getMonth(), atTenant.getDate())
}

/**
 * The value to store for a day picked in the browser: midnight that calendar
 * day at the tenant, matching how timeslot generation stores `date`.
 */
export function pickedDateToTenantDate(picked: Date, tenantTimeZone: string): string {
  const atTenant = new TZDate(
    picked.getFullYear(),
    picked.getMonth(),
    picked.getDate(),
    0,
    0,
    0,
    0,
    tenantTimeZone,
  )
  return new Date(atTenant.getTime()).toISOString()
}
