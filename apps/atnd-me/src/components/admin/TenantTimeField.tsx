'use client'

/**
 * Time picker for a time that means a time at the tenant: a scheduler slot's
 * start and end, and a timeslot's start and end. A picked time means that time
 * at the tenant, whatever time zone the admin's browser is in.
 *
 * Payload's own date field saves the picked time as an instant in the browser's
 * time zone, while the server reads it in the tenant's. This field converts
 * between the two on the way in and out of the picker; the value is still an
 * instant whose wall clock at the tenant is the time shown.
 */
import {
  DatePicker,
  FieldDescription,
  FieldError,
  FieldLabel,
  ShimmerEffect,
  fieldBaseClass,
  useField,
} from '@payloadcms/ui'
import { mergeFieldStyles } from '@payloadcms/ui/shared'
import type { ConditionalDateProps, DateFieldClientComponent } from 'payload'

import { pickedTimeToTenantTime, tenantTimeToPickerDate } from '@/utilities/tenantTimePicker'

import { useTenantTimeZone } from './useTenantTimeZone'

const baseClass = 'date-time-field'

export const TenantTimeField: DateFieldClientComponent = (props) => {
  const { field, path: pathFromProps, readOnly } = props
  const { admin, label, localized, required } = field

  const { disabled, path, setValue, showError, value } = useField<string | null>({
    potentiallyStalePath: pathFromProps,
  })

  const tenantTimeZone = useTenantTimeZone()
  const timeZone = tenantTimeZone.state === 'ready' ? tenantTimeZone.timeZone : null
  // Without the tenant's time zone a pick cannot be stored as the right instant.
  const locked = Boolean(readOnly || disabled || !timeZone)

  const onChange = (picked: Date | null) => {
    if (locked || !timeZone) return
    setValue(picked ? pickedTimeToTenantTime(picked, timeZone) : null)
  }

  const notice =
    tenantTimeZone.state === 'no-tenant'
      ? 'Select a tenant to set this time.'
      : tenantTimeZone.state === 'failed'
        ? "This tenant's time zone could not be loaded, so the time cannot be shown or changed. Reload the page to try again."
        : undefined

  return (
    <div
      className={[
        fieldBaseClass,
        baseClass,
        admin?.className,
        showError && `${baseClass}--has-error`,
        locked && 'read-only',
      ]
        .filter(Boolean)
        .join(' ')}
      style={mergeFieldStyles(field)}
    >
      <FieldLabel label={label} localized={localized} path={path} required={required} />
      <div className={`${fieldBaseClass}__wrap`} id={`field-${path.replace(/\./g, '__')}`}>
        <FieldError path={path} showError={showError} />
        {tenantTimeZone.state === 'loading' ? (
          <ShimmerEffect height={50} />
        ) : (
          <DatePicker
            {...(admin?.date as ConditionalDateProps | undefined)}
            onChange={onChange}
            readOnly={locked}
            value={(timeZone && tenantTimeToPickerDate(value, timeZone)) || undefined}
          />
        )}
      </div>
      <FieldDescription description={notice ?? admin?.description} path={path} />
    </div>
  )
}

export default TenantTimeField
