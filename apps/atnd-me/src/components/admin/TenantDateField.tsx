'use client'

/**
 * Day picker for a calendar date that means a day at the tenant (timeslot
 * `date`). Generated timeslots store midnight at the tenant; without this field
 * an admin west of the tenant sees the previous day in the picker.
 *
 * A picked day is stored as midnight that day at the tenant, matching generation.
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

import { pickedDateToTenantDate, tenantDateToPickerDate } from '@/utilities/tenantTimePicker'

import { useTenantTimeZone } from './useTenantTimeZone'

const baseClass = 'date-time-field'

export const TenantDateField: DateFieldClientComponent = (props) => {
  const { field, path: pathFromProps, readOnly } = props
  const { admin, label, localized, required } = field

  const { disabled, path, setValue, showError, value } = useField<string | null>({
    potentiallyStalePath: pathFromProps,
  })

  const tenantTimeZone = useTenantTimeZone()
  const timeZone = tenantTimeZone.state === 'ready' ? tenantTimeZone.timeZone : null
  const locked = Boolean(readOnly || disabled || !timeZone)

  const onChange = (picked: Date | null) => {
    if (locked || !timeZone) return
    setValue(picked ? pickedDateToTenantDate(picked, timeZone) : null)
  }

  const notice =
    tenantTimeZone.state === 'no-tenant'
      ? 'Select a tenant to set this date.'
      : tenantTimeZone.state === 'failed'
        ? "This tenant's time zone could not be loaded, so the date cannot be shown or changed. Reload the page to try again."
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
            value={(timeZone && tenantDateToPickerDate(value, timeZone)) || undefined}
          />
        )}
      </div>
      <FieldDescription description={notice ?? admin?.description} path={path} />
    </div>
  )
}

export default TenantDateField
