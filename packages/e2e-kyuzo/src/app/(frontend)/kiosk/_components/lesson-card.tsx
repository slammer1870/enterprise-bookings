'use client'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@repo/ui/components/ui/card'

import { Button } from '@repo/ui/components/ui/button'

import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/ui/popover'

import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@repo/ui/components/ui/command'

import { Booking, Lesson, User } from '@repo/shared-types'

import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'

import { useState } from 'react'
import { cn } from '@repo/ui/lib/utils'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@repo/ui/components/ui/dialog'

export const LessonCard = ({
  lesson,
  users,
  createBooking,
}: {
  lesson: Lesson
  users: User[]
  createBooking: (lessonId: number, userId: number) => Promise<Booking>
}) => {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const handleCheckIn = async () => {
    if (!value) return
    try {
      setIsLoading(true)
      await createBooking(lesson.id, Number(value))
      setError(null)
      setIsLoading(false)
      setOpen(false)
      setValue(null)
      toast.success(`Checked in ${users.find((user) => user.id.toString() === value)?.name}`)
    } catch (error) {
      setError('Failed to check in. Please see the desk for assistance.')
      console.error('Error in handleCheckIn', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <Card key={lesson.id.toString()} className="flex flex-col gap-2 p-4">
        <CardHeader>
          <CardDescription>
            {new Date(lesson.startTime).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            -{' '}
            {new Date(lesson.endTime).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </CardDescription>
          <CardTitle>
            {lesson.classOption.name} {lesson.location && `- ${lesson.location}`}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex justify-between gap-4">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-[200px] justify-between"
              >
                {value
                  ? users.find((user) => user.id.toString() === value)?.name
                  : 'Select user...'}
                <ChevronsUpDown className="opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Search user..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup>
                    {lesson.classOption.type === 'child'
                      ? users
                          .filter((user) => user.parent !== null)
                          .map((user) => (
                            <CommandItem
                              key={user.id}
                              value={user.id.toString()}
                              onSelect={(currentValue) => {
                                setValue(currentValue === value ? '' : currentValue)
                                setOpen(false)
                              }}
                            >
                              {user.name}
                              <Check
                                className={cn(
                                  'ml-auto',
                                  value === user.id.toString() ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                            </CommandItem>
                          ))
                      : users
                          .filter((user) => user.parent === null)
                          .map((user) => (
                            <CommandItem
                              key={user.id.toString()}
                              value={user.id.toString()}
                              onSelect={(currentValue) => {
                                setValue(currentValue === value ? '' : currentValue)
                                setOpen(false)
                              }}
                            >
                              {user.name}
                              <Check
                                className={cn(
                                  'ml-auto',
                                  value === user.id.toString() ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                            </CommandItem>
                          ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button onClick={handleCheckIn} disabled={isLoading || !value}>
            {isLoading ? <Loader2 className="animate-spin" /> : 'Check In'}
          </Button>
        </CardFooter>
      </Card>
      <Dialog open={error !== null} onOpenChange={() => setError(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your booking was not created</DialogTitle>
          </DialogHeader>
          <DialogDescription>{error}</DialogDescription>
          <DialogFooter>
            <Button onClick={() => setError(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
