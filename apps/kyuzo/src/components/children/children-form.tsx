'use client'

import { User } from '@repo/shared-types'
import { Button } from '@repo/ui/components/ui/button'
import { useActionState, useState } from 'react'
import { SelectChildren } from './select-children'
import { createChildrensBookings } from '@/actions/children'

export const ChildrenBookingForm = ({
  children,
  lessonId,
}: {
  children: User[]
  lessonId: string
}) => {
  const [selectedChildren, setSelectedChildren] = useState<User[]>([])

  const initialState = {
    message: '',
  }

  const [state, formAction, pending] = useActionState(createChildrensBookings, initialState)

  console.log('FORM STATE', state)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lessonId" value={lessonId} />
      {selectedChildren.map((child) => (
        <input key={child.id} type="hidden" name="childrenIds" value={child.id} />
      ))}
      <SelectChildren
        childrenData={children}
        selectedChildren={selectedChildren}
        setSelectedChildren={setSelectedChildren}
      />
      <p aria-live="polite">{state?.message}</p>

      <Button className="w-full" disabled={selectedChildren.length === 0 || pending}>
        {pending ? 'Completing Booking...' : 'Complete Booking'}
      </Button>
    </form>
  )
}
