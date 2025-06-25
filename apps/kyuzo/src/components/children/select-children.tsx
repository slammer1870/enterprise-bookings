'use client'

import { useState } from 'react'

import { User } from '@repo/shared-types'

import { Label } from '@repo/ui/components/ui/label'
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
  CommandSeparator,
} from '@repo/ui/components/ui/command'

import { Check, ChevronsUpDown, X } from 'lucide-react'

import { AddChild } from './add-child'
import { SelectedChildren } from './selected-children'

type SelectChildrenProps = {
  children: User[] | null
}

export const SelectChildren = ({ children }: SelectChildrenProps) => {
  const [selectedChildren, setSelectedChildren] = useState<User[]>()

  const handleSelectChild = (child: User) => {
    setSelectedChildren((prev) => {
      if (prev?.some((c) => c.id === child.id)) {
        return prev.filter((c) => c.id !== child.id)
      }
      return [...(prev || []), child]
    })
  }

  const handleRemoveChild = (child: User) => {
    setSelectedChildren((prev) => prev?.filter((c) => c.id !== child.id) || [])
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <h2 className="text-lg font-medium">Select a child</h2>
      <div className="flex flex-col gap-4">
        <SelectedChildren
          selectedChildren={selectedChildren || []}
          handleRemoveChild={handleRemoveChild}
        />
        {children && children.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
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
                      {children
                        ?.filter(
                          (child) =>
                            !selectedChildren?.some((selected) => selected.id === child.id),
                        )
                        .map((child) => (
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
                                child.id === selectedChildren?.find((c) => c.id === child.id)?.id
                                  ? 'opacity-100'
                                  : 'opacity-0',
                              )}
                            />
                            {child.name} - {child.email}
                          </CommandItem>
                        ))}
                      <CommandSeparator />
                      <CommandItem>
                        <AddChild handleSelectChild={handleSelectChild} />
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    </div>
  )
}
