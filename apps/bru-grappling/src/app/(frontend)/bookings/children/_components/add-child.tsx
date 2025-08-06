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

const FormSchema = z.object({
  name: z.string().min(1, { message: 'Please enter the name of the child.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
})

export const AddChild = ({
  addChildData,
}: {
  addChildData: (data: z.infer<typeof FormSchema>) => void
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  })
  const [isLoading, setIsLoading] = useState(false)

  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast('You submitted the following values', {
      description: (
        <pre className="mt-2 w-[320px] rounded-md bg-neutral-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    })
    // TODO: Add the child on success of the mutation
    addChildData(data)
    setIsOpen(false)
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="john.doe@example.com" {...field} />
                  </FormControl>
                  <FormDescription>This is the email of the child.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
