'use client'

import { useTRPC } from '@repo/trpc'
import { useSuspenseQuery } from '@tanstack/react-query'

import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/ui/popover'

import { FormControl } from '@repo/ui/components/ui/form'

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
  field,
  setChildData,
}: {
  field: any
  setChildData: (data: { name: string; email: string }) => void
}) => {
  const trpc = useTRPC()

  const { data: children } = useSuspenseQuery(trpc.users.getChildren.queryOptions())

  return (
    <Popover>
      <PopoverTrigger asChild>
        <FormControl>
          <Button
            variant="outline"
            role="combobox"
            className={cn('w-[200px] justify-between', !field.value && 'text-muted-foreground')}
          >
            Select children
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </FormControl>
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
                    setChildData({
                      name: child.name || '',
                      email: child.email || '',
                    })
                  }}
                >
                  {child.name}
                  <Check
                    className={cn(
                      'ml-auto',
                      field.value?.some((c: User) => c.email === child.email)
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
          <AddChild setChildData={setChildData} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
