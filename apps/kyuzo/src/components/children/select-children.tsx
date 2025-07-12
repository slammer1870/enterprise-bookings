'use client'

import { User } from '@repo/shared-types'

import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/ui/popover'
import { Button } from '@repo/ui/components/ui/button'

import { cn } from '@repo/ui/lib/utils'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@repo/ui/components/ui/command'

import { Check, ChevronsUpDown } from 'lucide-react'

import { AddChild } from './add-child'
import { SelectedChildren } from './selected-children'

type SelectChildrenProps = {
  childrenData: User[] | null
  selectedChildren: User[] | null
  setSelectedChildren: (children: User[] | ((prev: User[]) => User[])) => void
}

export const SelectChildren = ({
  childrenData,
  selectedChildren,
  setSelectedChildren,
}: SelectChildrenProps) => {
  const handleSelectChild = (child: User) => {
    setSelectedChildren((prev) => {
      if (prev?.some((c) => c.id === child.id)) {
        return prev.filter((c) => c.id !== child.id)
      }
      return [...(prev || []), child]
    })
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <h2 className="text-lg font-medium">Select a child</h2>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              'w-full justify-between text-xs',
              !selectedChildren?.length && 'text-muted-foreground',
            )}
          >
            Select Child
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search child..." className="border-none" />
            <CommandList>
              <CommandEmpty>No children found.</CommandEmpty>
              <CommandGroup>
                {childrenData?.map((child) => (
                  <CommandItem
                    value={`${child.email}`}
                    key={child.id}
                    onSelect={() => {
                      handleSelectChild(child)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        child.email ===
                          selectedChildren?.find((c) => c.email === child.email)?.email
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    {child.name} - {child.email}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          {/* TODO: Add limits to the number of children based on the subscription and the number of places available */}
          <div className="p-2 border-t">
            <AddChild handleSelectChild={handleSelectChild} />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
