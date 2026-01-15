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
import { cn } from '@repo/ui/lib/utils'

import type { Lesson, User } from '@repo/shared-types'

import { Check, ChevronDown, ChevronLeft, ChevronsUpDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

import { useTRPC } from '@repo/trpc/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function KioskLessonCard({ lesson, users }: { lesson: Lesson; users: User[] }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const kioskCheckIn = useMutation(
    trpc.bookings.kioskCreateOrConfirmBooking.mutationOptions({
      onSuccess: async () => {
        // Query-level revalidation: refetch kiosk lessons so bookings/capacity update.
        await queryClient.invalidateQueries({ queryKey: trpc.lessons.getForKiosk.queryKey() })
      },
    }),
  )

  const handleCheckIn = async () => {
    if (!value) return
    try {
      await kioskCheckIn.mutateAsync({ lessonId: lesson.id, userId: Number(value) })
      setError(null)
      setOpen(false)
      setValue(null)
      toast.success(`Checked in ${users.find((user) => user.id.toString() === value)?.name}`)
    } catch (err) {
      setError('Failed to check in. Please see the desk for assistance.')
      console.error('Error in handleCheckIn', err)
    }
  }

  // In some contexts (notably CI/dev + virtual fields), `remainingCapacity` can be missing.
  // Fall back to computing it from classOption.places - confirmed bookings.
  // Also handle the case where classOption might be just an ID (not populated).
  const classOptionObj =
    typeof lesson.classOption === 'object' && lesson.classOption !== null ? lesson.classOption : null
  const places = typeof classOptionObj?.places === 'number' ? classOptionObj.places : 50 // Default to 50 if missing
  const confirmedBookings = Array.isArray(lesson.bookings?.docs)
    ? lesson.bookings.docs.filter((b) => b?.status === 'confirmed').length
    : 0
  const computedRemaining = Math.max(places - confirmedBookings, 0)
  const remainingCapacity =
    typeof (lesson as any).remainingCapacity === 'number' ? (lesson as any).remainingCapacity : computedRemaining

  return (
    <div>
      <Card
        key={lesson.id.toString()}
        className="flex flex-col gap-2 p-4"
        data-testid={`kiosk-lesson-card-${lesson.id}`}
      >
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
                  {classOptionObj?.name ?? 'Class'} {lesson.location && `- ${lesson.location}`}
                </CardTitle>
              </div>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => setCollapsed(!collapsed)}
                  data-testid="kiosk-open-checkin"
                >
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
              <div className="flex flex-col gap-2 mt-2" data-testid="kiosk-bookings-list">
                {lesson.bookings.docs.length === 0 && <p>No bookings</p>}
                {lesson.bookings.docs.map(
                  (booking) =>
                    booking.status === 'confirmed' && (
                      <div key={booking.id}>
                        <div className="flex items-center">
                          <Check className="mr-2 w-4 h-4" />
                          <p>{booking.user.name}</p>
                        </div>
                      </div>
                    ),
                )}
              </div>
            </CardContent>
            <CardFooter>
              {remainingCapacity > 0 ? (
                <div className="flex justify-between gap-4">
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-[200px] justify-between"
                        data-testid="kiosk-user-combobox"
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
                            {classOptionObj?.type === 'child'
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
                  <Button
                    onClick={handleCheckIn}
                    disabled={kioskCheckIn.isPending || !value}
                    data-testid="kiosk-submit-checkin"
                  >
                    {kioskCheckIn.isPending ? <Loader2 className="animate-spin" /> : 'Check In'}
                  </Button>
                </div>
              ) : (
                <div className="flex justify-between gap-4">
                  <p className="text-sm text-muted-foreground">This class is full</p>
                </div>
              )}
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


