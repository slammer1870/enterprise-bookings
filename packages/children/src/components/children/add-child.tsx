'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/ui/dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@repo/ui/components/ui/button'
import { Form, FormControl, FormItem, FormLabel, FormMessage } from '@repo/ui/components/ui/form'
import { Input } from '@repo/ui/components/ui/input'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useState } from 'react'
import { createChild } from '@/actions/children'
import { useAuth } from '@repo/auth'

import { toast } from 'sonner'

import { User } from '@repo/shared-types'

const formSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

export const AddChild = ({ handleSelectChild }: { handleSelectChild: (child: User) => void }) => {
  const [isOpen, setIsOpen] = useState(false)
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  })
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const handleAddChild = async (data: z.infer<typeof formSchema>) => {
    setIsLoading(true)
    try {
      if (!user) return
      const child = await createChild({ name: data.name, email: data.email, parent: user.id })
      handleSelectChild(child as User)
      setIsLoading(false)
      setIsOpen(false)
      form.reset()
      toast.success('Child added successfully')
    } catch (error: unknown) {
      setIsLoading(false)

      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

      if (errorMessage === 'ValidationError: The following field is invalid: email') {
        form.setError('root', {
          message: 'Child already exists. Please try a different email.',
        })
        return
      }

      form.setError('root', {
        message: errorMessage || 'An unexpected error occurred. Please try again.',
      })
    }
  }
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full">
          + Add new child
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add new child</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Add a new child to the booking. You can add multiple children to the booking.
        </DialogDescription>
        {form.formState.errors.root && (
          <div className="bg-red-50 p-3 rounded-md text-red-600 text-sm">
            {form.formState.errors.root.message}
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleAddChild)} className="flex flex-col gap-4">
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...form.register('name')} type="text" required />
              </FormControl>
            </FormItem>
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...form.register('email')} type="email" required />
              </FormControl>
            </FormItem>
            <div className="flex gap-2 w-full">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Adding...' : 'Add child'}
              </Button>
            </div>
          </form>
          <FormMessage />
        </Form>
      </DialogContent>
    </Dialog>
  )
}
