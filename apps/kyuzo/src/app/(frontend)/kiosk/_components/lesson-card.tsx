'use client'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  CardContent,
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

import { Check, ChevronDown, ChevronLeft, ChevronsUpDown, Loader2 } from 'lucide-react'

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

import { Separator } from '@repo/ui/components/ui/separator'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/components/ui/collapsible'

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

  const [collapsed, setCollapsed] = useState(true)

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
        <Collapsible>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-2">
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
                <CardTitle className="flex justify-between items-center">
                  {lesson.classOption.name} {lesson.location && `- ${lesson.location}`}
                </CardTitle>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="outline" onClick={() => setCollapsed(!collapsed)}>
                  {!collapsed ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <>
                      <ChevronLeft className="w-4 h-4" />
                      <span className="text-sm">Check In</span>
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <p className="font-medium mb-2">Bookings</p>
              <Separator />
              <div className="flex flex-col gap-2 mt-2">
                {lesson.bookings.docs.length === 0 && <p>No bookings</p>}
                {lesson.bookings.docs.map((booking) => (
                  <div key={booking.id}>
                    <div className="flex items-center">
                      <Check className="mr-2 w-4 h-4" />
                      <p>{booking.user.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
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
                                  value={`${user.name} - ${user.email}`}
                                  onSelect={(currentValue) => {
                                    const selectedUser = users.find(
                                      (u) => `${u.name} - ${u.email}` === currentValue,
                                    )
                                    const userIdString = selectedUser?.id.toString() || ''
                                    setValue(userIdString === value ? '' : userIdString)
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
                                  value={`${user.name} - ${user.email}`}
                                  onSelect={(currentValue) => {
                                    const selectedUser = users.find(
                                      (u) => `${u.name} - ${u.email}` === currentValue,
                                    )
                                    const userIdString = selectedUser?.id.toString() || ''
                                    setValue(userIdString === value ? '' : userIdString)
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
          </CollapsibleContent>
        </Collapsible>
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
