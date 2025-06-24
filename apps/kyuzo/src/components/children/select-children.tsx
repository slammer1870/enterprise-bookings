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
} from '@repo/ui/components/ui/command'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@repo/ui/components/ui/dialog'
import { Form } from '@repo/ui/components/ui/form'
import { FormItem, FormControl, FormLabel, FormMessage } from '@repo/ui/components/ui/form'
import { Input } from '@repo/ui/components/ui/input'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useForm } from 'react-hook-form'

import { createChild } from '@/actions/children'
import { useAuth } from '@repo/auth/src/providers/auth'
import { useRouter } from 'next/navigation'

const formSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

type FormSchema = z.infer<typeof formSchema>

type SelectChildrenProps = {
  children: User[] | null
}

export const SelectChildren = ({ children }: SelectChildrenProps) => {
  const { user } = useAuth()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedChildren, setSelectedChildren] = useState<User[]>([])
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  })

  // Handle authentication check
  if (!user) {
    router.push('/login')
    return null
  }

  const handleSelectChild = (child: User) => {
    setSelectedChildren((prev) => {
      if (prev.includes(child)) {
        return prev.filter((c) => c.id !== child.id)
      }
      return [...prev, child]
    })
  }

  const handleRemoveChild = (child: User) => {
    setSelectedChildren((prev) => prev.filter((c) => c.id !== child.id))
  }

  const handleAddChild = (data: FormSchema) => {
    setIsLoading(true)
    createChild({ name: data.name, email: data.email, parent: user.id })
    setIsLoading(false)
    setIsOpen(false)
    form.reset()
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <h2 className="text-2xl font-bold">Select a child</h2>
      <div className="flex flex-col gap-4">
        {selectedChildren.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label>Selected children</Label>
            <div className="flex flex-col gap-2">
              {selectedChildren.map((child) => (
                <div key={child.id} className="flex items-center gap-2 justify-between">
                  <p>
                    {child.name} - {child.email}
                  </p>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveChild(child)}
                    className="p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        {children && children.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label>Select User</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    'w-full justify-between text-xs',
                    !selectedChildren.length && 'text-muted-foreground',
                  )}
                >
                  Select Child
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0">
                <Command>
                  <CommandInput placeholder="Search child..." className="border-none" />
                  <CommandList>
                    <CommandEmpty>No children found.</CommandEmpty>
                    <CommandGroup>
                      {children
                        ?.filter((child) => !selectedChildren.includes(child))
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
                                child.id === selectedChildren.find((c) => c.id === child.id)?.id
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
              </PopoverContent>
            </Popover>
          </div>
        )}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>Add new child</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add new child</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              Add a new child to the booking. You can add multiple children to the booking.
            </DialogDescription>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAddChild)} className="flex flex-col gap-2">
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...form.register('name')} />
                  </FormControl>
                </FormItem>
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...form.register('email')} />
                  </FormControl>
                </FormItem>
                <div className="flex gap-2 w-full">
                  <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? 'Adding...' : 'Add child'}
                  </Button>
                </div>
              </form>
              <FormMessage />
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
