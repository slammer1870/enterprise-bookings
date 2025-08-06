'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@repo/ui/components/ui/button'

import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@repo/ui/components/ui/form'

import { SelectChildren } from './select-children'

const FormSchema = z.object({
  children: z
    .array(
      z.object({
        name: z.string().min(1, { message: 'Please enter the name of the child.' }),
        email: z.email({ message: 'Please enter a valid email address.' }),
      }),
    )
    .refine(
      (children) => {
        const emails = children.map((child) => child.email)
        const uniqueEmails = new Set(emails)
        return emails.length === uniqueEmails.size
      },
      {
        message: 'Each child must have a unique email address.',
        path: ['children'],
      },
    ),
})

export const ChildrensBookingForm = ({
  bookedChildren,
}: {
  bookedChildren?: z.infer<typeof FormSchema>['children']
}) => {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      children: bookedChildren || [],
    },
  })

  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast('You submitted the following values', {
      description: (
        <pre className="mt-2 w-[320px] rounded-md bg-neutral-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    })
  }

  const setChildData = (data: z.infer<typeof FormSchema>['children'][0]) => {
    const currentChildren = form.getValues('children') || []

    if (currentChildren.find((child) => child.email === data.email)) {
      return form.setValue(
        'children',
        currentChildren.filter((child) => child.email !== data.email),
      )
    }

    const newChildren = [...currentChildren, data]
    return form.setValue('children', newChildren)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="children"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Children</FormLabel>
              <FormDescription>
                You can add multiple children to the booking. You can also remove children from the
                booking.
              </FormDescription>
              <div className="flex flex-col gap-2">
                {field.value?.map((child, index) => (
                  <div key={index} className="flex justify-between">
                    <div>
                      {child.name} - {child.email}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setChildData({ name: child.name, email: child.email })}
                    >
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
              <SelectChildren field={field} setChildData={setChildData} />
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
