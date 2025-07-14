'use client'

import { Booking, User } from '@repo/shared-types'
import { Button } from '@repo/ui/components/ui/button'
import { useActionState, useState } from 'react'
import { SelectChildren } from './select-children'
import { createChildrensBookings } from '@/actions/children'
import { SelectedChildren } from './selected-children'

export const ChildrenBookingForm = ({
  childrenData,
  lessonId,
  lessonBookingLimit,
  childrenBookings,
}: {
  childrenData: User[]
  lessonId: string
  lessonBookingLimit: number
  childrenBookings: Booking[] | null
}) => {
  const [selectedChildren, setSelectedChildren] = useState<User[]>(
    childrenBookings?.map((booking) => booking.user) || [],
  )

  const handleRemoveChild = (child: User) => {
    setSelectedChildren((prev) => prev?.filter((c) => c.id !== child.id) || [])
  }

  const initialState = {
    message: '',
  }

  const [state, formAction, pending] = useActionState(createChildrensBookings, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lessonId" value={lessonId} />
      {selectedChildren.map((child) => (
        <input key={child.id} type="hidden" name="childrenIds" value={child.id} />
      ))}
      <SelectedChildren
        selectedChildren={selectedChildren || []}
        handleRemoveChild={handleRemoveChild}
      />
      {selectedChildren.length < lessonBookingLimit ? (
        <SelectChildren
          childrenData={childrenData}
          selectedChildren={selectedChildren}
          setSelectedChildren={setSelectedChildren}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          You have reached the maximum number of children for this lesson.
        </p>
      )}
      <p aria-live="polite" className="text-sm text-red-500">
        {state?.message}
      </p>

      <Button className="w-full" disabled={selectedChildren.length > lessonBookingLimit || pending}>
        {pending ? 'Completing Booking...' : 'Complete Booking'}
      </Button>
    </form>
  )
}
