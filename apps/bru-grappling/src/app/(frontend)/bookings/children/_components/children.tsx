'use client'

import { useTRPC } from '@/trpc/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'

export const ChildrensBooking = async () => {
  const params = useParams()
  const id = params.id as string
  const trpc = useTRPC()
  const { data } = useSuspenseQuery(trpc.lessons.getById.queryOptions({ id: parseInt(id) }))

  return (
    <div>
      <h1>{data.startTime}</h1>
    </div>
  )
}
