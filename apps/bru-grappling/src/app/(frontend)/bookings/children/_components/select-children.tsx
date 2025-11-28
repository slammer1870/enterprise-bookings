'use client'

import { useTRPC } from '@repo/trpc'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'

import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/ui/popover'

import { Button } from '@repo/ui/components/ui/button'

import { cn } from '@repo/ui/lib/utils'

import { ChevronsUpDown } from 'lucide-react'

import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@repo/ui/components/ui/command'

import { Check } from 'lucide-react'

import { AddChild } from './add-child'

import { User } from '@repo/shared-types'

export const SelectChildren = ({
  lessonId,
  bookedChildren,
  bookChild,
  isBooking,
}: {
  lessonId: number
  bookedChildren: User[]
  bookChild: (data: { lessonId: number; childId: number; status?: 'confirmed' | 'pending' }) => void
  isBooking: boolean
}) => {
  const trpc = useTRPC()

  const { data: children, isPending } = useSuspenseQuery(trpc.users.getChildren.queryOptions())

  const childrenList = Array.isArray(children) ? children : []

  return (
    <>
      {childrenList.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild disabled={isPending || isBooking} className="w-full">
            <Button
              variant="outline"
              role="combobox"
              className={cn(
                'w-full justify-between',
                !bookedChildren?.length && 'text-muted-foreground',
              )}
            >
              Select children
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command>
              <CommandInput placeholder="Search children..." className="h-9" />
              <CommandList>
                <CommandEmpty>No children found.</CommandEmpty>
                <CommandGroup>
                  {childrenList.map((child: any) => (
                    <CommandItem
                      value={child.name}
                      key={child.name}
                      onSelect={() => {
                        bookChild({ lessonId, childId: child.id, status: 'confirmed' })
                      }}
                      disabled={bookedChildren?.some((c) => c.id === child.id)}
                    >
                      {child.name}
                      <Check
                        className={cn(
                          'ml-auto',
                          bookedChildren?.some((c) => c.email === child.email)
                            ? 'opacity-100'
                            : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            <div className="p-2 border-t">
              <AddChild bookChild={bookChild} lessonId={lessonId} />
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <div className="flex flex-col gap-2">
          <p>Please register your first child to book this lesson.</p>
          <AddChild bookChild={bookChild} lessonId={lessonId} />
        </div>
      )}
    </>
  )
}
