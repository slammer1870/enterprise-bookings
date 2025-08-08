'use client'

import { useTRPC } from '@repo/trpc'
import { useSuspenseQuery } from '@tanstack/react-query'

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

import { User } from '@repo/shared-types'

import { AddChild } from './add-child'

export const SelectChildren = ({
  bookedChildren,
  bookChild,
  lessonId,
}: {
  bookedChildren?: User[]
  bookChild: (data: { lessonId: number; childId: number }) => void
  lessonId: number
}) => {
  const trpc = useTRPC()

  const { data: children, isPending } = useSuspenseQuery(trpc.users.getChildren.queryOptions())

  return (
    <Popover>
      <PopoverTrigger asChild disabled={isPending}>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            'w-[200px] justify-between',
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
              {children?.map((child) => (
                <CommandItem
                  value={child.name}
                  key={child.name}
                  onSelect={() => {
                    bookChild({ lessonId: lessonId, childId: child.id })
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
  )
}
