'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Timeslot } from '@repo/shared-types'
import { SelectionProvider, useConfig, SelectAll, ListSelection } from '@payloadcms/ui'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@repo/ui/components/ui/table'
import { TimeslotDetail } from './TimeslotDetail'

const COLLECTION_SLUG = 'timeslots'
const BULK_BAR_PORTAL_ID = 'timeslots-bulk-bar-portal'

function TimeslotsBulkBar() {
  const { getEntityConfig } = useConfig()
  const collectionConfig = getEntityConfig({ collectionSlug: COLLECTION_SLUG })
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.getElementById(BULK_BAR_PORTAL_ID))
  }, [])

  if (!collectionConfig) return null

  const label =
    typeof collectionConfig.labels?.plural === 'string'
      ? collectionConfig.labels.plural
      : 'Timeslots'

  const content = <ListSelection collectionConfig={collectionConfig} label={label} />

  if (portalTarget) {
    return createPortal(content, portalTarget)
  }

  return <div className="mb-2 flex justify-end">{content}</div>
}

function TimeslotTableContent({ timeslots }: { timeslots: Timeslot[] }) {
  if (!timeslots?.length) {
    return (
      <TableRow className="[&_td]:py-1.5">
        <TableCell colSpan={6} className="text-center">
          No classes for selected date
        </TableCell>
      </TableRow>
    )
  }
  return (
    <>
      {timeslots.map((timeslot) => (
        <TimeslotDetail key={timeslot.id} timeslot={timeslot} />
      ))}
    </>
  )
}

export const TimeslotsListWithSelection: React.FC<{
  timeslots: Timeslot[]
  listKey?: string
}> = ({ timeslots, listKey }) => {
  const docs = React.useMemo(
    () =>
      (timeslots ?? []).map((l) => ({
        id: String(l.id),
        _isLocked: false,
      })),
    [timeslots],
  )
  const totalDocs = docs.length

  return (
    <SelectionProvider docs={docs} totalDocs={totalDocs} key={listKey}>
      <TimeslotsBulkBar />
      <Table>
        <TableHeader>
          <TableRow className="[&_th]:py-1.5 [&_th]:h-auto">
            <TableHead className="w-10">
              <SelectAll />
            </TableHead>
            <TableHead>Start Time</TableHead>
            <TableHead>End Time</TableHead>
            <TableHead>Event Type</TableHead>
            <TableHead>Bookings</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TimeslotTableContent timeslots={timeslots ?? []} />
        </TableBody>
      </Table>
    </SelectionProvider>
  )
}
