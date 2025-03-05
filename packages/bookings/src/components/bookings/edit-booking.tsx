"use client";

import React from "react";

import { zodResolver } from "@hookform/resolvers/zod";

import { useForm } from "react-hook-form";

import { Booking } from "@repo/shared-types";

import { Button } from "@repo/ui/components/ui/button";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/ui/components/ui/dialog";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";

import { z } from "zod";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@repo/ui/components/ui/select";

import { Label } from "@repo/ui/components/ui/label";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function EditBooking({ booking }: { booking: Booking }) {
  const [open, setOpen] = useState(false);

  const router = useRouter();

  const FormData = z.object({
    user: z.number(),
    status: z.string(),
  });

  type FormSchema = z.infer<typeof FormData>;

  const form = useForm<FormSchema>({
    resolver: zodResolver(FormData),
    defaultValues: {
      user: booking.user.id,
      status: booking.status,
    },
  });

  async function onSubmit(data: FormSchema) {
    const response = await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        status: data.status,
        // Add any other necessary booking data
      }),
    });

    const { errors } = await response.json();

    if (errors) {
      return toast.error(errors[0].message || "An error occurred");
    }

    setOpen(false);
    toast.success("Booking updated successfully");
    form.reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Manage Booking
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Booking</DialogTitle>
          <DialogDescription>
            Make changes to your booking here. Click save when you are done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-start">
                <Label className="mb-2">Name</Label>
                <p className="text-sm">
                  {typeof booking.user === "object"
                    ? booking.user.email
                    : booking.user}
                </p>
              </div>
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a class for this lesson" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
