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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@repo/ui/components/ui/form'
import { Input } from '@repo/ui/components/ui/input'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useState } from 'react'

import { toast } from 'sonner'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@repo/trpc/client'

const formSchema = z.object({
  name: z.string().min(1, { message: 'Please enter the name of the child.' }),
  email: z.email({ message: 'Please enter a valid email address.' }),
})

export const AddChild = ({
  bookChild,
  lessonId,
}: {
  bookChild: (data: { lessonId: number; childId: number }) => void
  lessonId: number
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { mutate: createChildRaw, isPending } = useMutation(
    trpc.users.createChild.mutationOptions({
      onSuccess: (data: any) => {
        bookChild({ lessonId, childId: data.id })

        queryClient.invalidateQueries({
          queryKey: trpc.users.getChildren.queryKey(),
        }) 

        toast.success('Child added successfully')
        setIsOpen(false)
        form.reset()
      },
      onError: (error: any) => {
        // Clear any existing errors first
        form.clearErrors()

        const errorMessage = error?.message || 'An unexpected error occurred'

        // Handle specific error cases
        if (
          errorMessage.includes('E11000') ||
          errorMessage.includes('duplicate') ||
          errorMessage.includes('already exists')
        ) {
          form.setError('email', {
            message: 'This email is already in use. Please use a different email address.',
          })
          return
        }

        // Handle validation errors
        if (errorMessage.includes('ValidationError') || errorMessage.includes('invalid')) {
          if (errorMessage.toLowerCase().includes('email')) {
            form.setError('email', {
              message: 'Please enter a valid email address.',
            })
            return
          }
          if (errorMessage.toLowerCase().includes('name')) {
            form.setError('name', {
              message: 'Please enter a valid name.',
            })
            return
          }
        }

        // Handle general errors with root error (displays at bottom of form)
        form.setError('root', {
          message: errorMessage,
        })

        toast.error('Failed to add child')
      },
    }),
  )
  // tRPC + TanStack inference occasionally widens mutation variables to `void` across package boundaries.
  // We keep runtime behavior correct and narrow the call signature locally.
  const createChild = createChildRaw as unknown as (input: { name: string; email: string }) => void

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  })

  function onSubmit(data: z.infer<typeof formSchema>) {
    createChild({
      name: data.name,
      email: data.email,
    })
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open)
        if (open) {
          // Clear form and errors when opening dialog
          form.reset()
          form.clearErrors()
        }
      }}
    >
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormDescription>This is the name of the child.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Child&apos;s email</FormLabel>
                  <FormControl>
                    <Input placeholder="john.doe@example.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    This is the email of the child (you can use a dummy email).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2 w-full">
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Adding...' : 'Add child'}
              </Button>
            </div>
            {form.formState.errors.root && (
              <div className="text-red-500 text-sm mt-2">{form.formState.errors.root.message}</div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
