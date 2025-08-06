'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { cn } from '@repo/ui/lib/utils'
import { Button } from '@repo/ui/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@repo/ui/components/ui/command'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@repo/ui/components/ui/form'
import { Popover, PopoverContent, PopoverTrigger } from '@repo/ui/components/ui/popover'
import { AddChild } from './add-child'

const FormSchema = z.object({
  children: z.array(
    z.object({
      name: z.string().min(1, { message: 'Please enter the name of the child.' }),
      email: z.string().email({ message: 'Please enter a valid email address.' }),
    }),
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

  const addChildData = (data: z.infer<typeof FormSchema>['children'][0]) => {
    const currentChildren = form.getValues('children') || []
    return form.setValue('children', [...currentChildren, data])
  }

  const removeChild = (data: z.infer<typeof FormSchema>['children'][0]) => {
    const currentChildren = form.getValues('children') || []
    return form.setValue(
      'children',
      currentChildren.filter((child) => child.email !== data.email),
    )
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
                    <Button type="button" variant="ghost" onClick={() => removeChild(child)}>
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        'w-[200px] justify-between',
                        !field.value && 'text-muted-foreground',
                      )}
                    >
                      Select children
                      <ChevronsUpDown className="opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search children..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No children found.</CommandEmpty>
                      <CommandGroup>
                        {bookedChildren?.map((child) => (
                          <CommandItem
                            value={child.name}
                            key={child.name}
                            onSelect={() => {
                              addChildData(child)
                            }}
                          >
                            {child.name}
                            <Check
                              className={cn(
                                'ml-auto',
                                field.value?.some((c) => c.email === child.email)
                                  ? 'opacity-100'
                                  : 'opacity-0',
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="p-2 border-t">
                    <AddChild addChildData={addChildData} />
                  </div>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
