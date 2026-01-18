"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  AdminDialog,
  AdminDialogContent,
} from "@repo/ui/components/ui/admin-dialog";
import {
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
import { Button } from "@repo/ui/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@repo/ui/components/ui/select";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import type { TimeSlotData } from "../../lib/scheduler-calendar-utils";

interface EditTimeSlotDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (slotData: TimeSlotData) => void;
  onDelete?: () => void;
  initialSlot?: TimeSlotData;
  defaultClassOption?: number | { id: number; name?: string };
  defaultLockOutTime?: number;
}

interface ClassOption {
  id: number;
  name?: string;
  slug?: string;
}

interface User {
  id: number;
  email?: string;
  name?: string;
}

const timeSlotSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  classOption: z.union([z.number(), z.string()]).optional(),
  location: z.string().optional(),
  instructor: z.union([z.number(), z.string()]).optional(),
  lockOutTime: z.number().optional(),
});

type TimeSlotFormData = z.infer<typeof timeSlotSchema>;

export const EditTimeSlotDialog: React.FC<EditTimeSlotDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialSlot,
  defaultClassOption,
  defaultLockOutTime = 0,
}) => {
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [instructors, setInstructors] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize form with initial slot or defaults
  const form = useForm<TimeSlotFormData>({
    resolver: zodResolver(timeSlotSchema),
    defaultValues: {
      startTime: initialSlot?.startTime
        ? format(new Date(initialSlot.startTime), "HH:mm")
        : "",
      endTime: initialSlot?.endTime
        ? format(new Date(initialSlot.endTime), "HH:mm")
        : "",
      classOption:
        initialSlot?.classOption !== undefined
          ? typeof initialSlot.classOption === "object"
            ? initialSlot.classOption.id
            : initialSlot.classOption
          : typeof defaultClassOption === "object"
            ? defaultClassOption.id
            : defaultClassOption,
      location: initialSlot?.location || "",
      instructor:
        initialSlot?.instructor !== undefined
          ? typeof initialSlot.instructor === "object"
            ? initialSlot.instructor.id
            : initialSlot.instructor
          : undefined,
      lockOutTime: initialSlot?.lockOutTime ?? defaultLockOutTime,
    },
  });

  // Reset form when initialSlot changes
  useEffect(() => {
    if (initialSlot) {
      form.reset({
        startTime: format(new Date(initialSlot.startTime), "HH:mm"),
        endTime: format(new Date(initialSlot.endTime), "HH:mm"),
        classOption:
          typeof initialSlot.classOption === "object"
            ? initialSlot.classOption.id
            : initialSlot.classOption,
        location: initialSlot.location || "",
        instructor:
          typeof initialSlot.instructor === "object"
            ? initialSlot.instructor.id
            : initialSlot.instructor,
        lockOutTime: initialSlot.lockOutTime ?? defaultLockOutTime,
      });
    } else {
      form.reset({
        startTime: "",
        endTime: "",
        classOption:
          typeof defaultClassOption === "object"
            ? defaultClassOption.id
            : defaultClassOption,
        location: "",
        instructor: undefined,
        lockOutTime: defaultLockOutTime,
      });
    }
  }, [initialSlot, defaultClassOption, defaultLockOutTime, form]);

  // Fetch class options and instructors
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch class options
        const classOptionsResponse = await fetch("/api/class-options?limit=1000", {
          credentials: "include",
        });
        if (classOptionsResponse.ok) {
          const classOptionsData = await classOptionsResponse.json();
          setClassOptions(classOptionsData.docs || []);
        }

            // Fetch instructors (users - filter can be added later if needed)
            const instructorsResponse = await fetch(
              "/api/users?limit=1000",
              {
                credentials: "include",
              }
            );
        if (instructorsResponse.ok) {
          const instructorsData = await instructorsResponse.json();
          setInstructors(instructorsData.docs || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      void fetchData();
    }
  }, [isOpen]);

  const onSubmit = (data: TimeSlotFormData) => {
    console.log("[EditTimeSlotDialog] onSubmit called with data:", data);
    
    // Parse time strings and combine with a reference date to create Date objects
    const startTimeParts = data.startTime.split(":").map(Number);
    const endTimeParts = data.endTime.split(":").map(Number);
    const startHours = startTimeParts[0] ?? 0;
    const startMinutes = startTimeParts[1] ?? 0;
    const endHours = endTimeParts[0] ?? 0;
    const endMinutes = endTimeParts[1] ?? 0;

    // Use today's date as reference, but the actual date will be set by the calendar
    const referenceDate = new Date();
    const startTime = new Date(referenceDate);
    startTime.setHours(startHours, startMinutes, 0, 0);

    const endTime = new Date(referenceDate);
    endTime.setHours(endHours, endMinutes, 0, 0);

    // Validate end time is after start time
    if (endTime <= startTime) {
      console.log("[EditTimeSlotDialog] Validation failed: end time must be after start time");
      form.setError("endTime", {
        type: "manual",
        message: "End time must be after start time",
      });
      return;
    }

    const slotData: TimeSlotData = {
      id: initialSlot?.id,
      startTime,
      endTime,
      classOption: data.classOption ? Number(data.classOption) : undefined,
      location: data.location || undefined,
      instructor: data.instructor && data.instructor !== "none" ? Number(data.instructor) : undefined,
      lockOutTime: data.lockOutTime,
    };

    console.log("[EditTimeSlotDialog] Calling onSave with slotData:", slotData);
    onSave(slotData);
    console.log("[EditTimeSlotDialog] onSave call completed");
  };

  React.useEffect(() => {
    if (isOpen) {
      console.log("[EditTimeSlotDialog] Dialog opened");
      console.log("[EditTimeSlotDialog] initialSlot:", initialSlot);
    } else {
      console.log("[EditTimeSlotDialog] Dialog closed");
    }
  }, [isOpen, initialSlot]);

  return (
    <AdminDialog open={isOpen} onOpenChange={onClose}>
      <AdminDialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialSlot ? "Edit Time Slot" : "Create Time Slot"}
          </DialogTitle>
          <DialogDescription>
            {initialSlot
              ? "Modify the time slot details below."
              : "Fill in the details for the new time slot."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        required
                        step="900"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        required
                        step="900"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="classOption"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Class Option</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ? field.value.toString() : undefined}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a class option" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {classOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id.toString()}>
                          {option.name || option.slug || `Option ${option.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Main Studio, Room 1"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instructor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructor (Optional)</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value === "none" ? undefined : value);
                    }}
                    value={field.value ? field.value.toString() : "none"}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an instructor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {instructors.map((instructor) => (
                        <SelectItem
                          key={instructor.id}
                          value={instructor.id.toString()}
                        >
                          {instructor.name ||
                            instructor.email ||
                            `User ${instructor.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lockOutTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lock Out Time (minutes)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      value={field.value ?? defaultLockOutTime}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                      min="0"
                      placeholder={defaultLockOutTime.toString()}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex items-center justify-between gap-2">
              <div>
                {initialSlot && onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={onDelete}
                    disabled={form.formState.isSubmitting || isLoading}
                  >
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={form.formState.isSubmitting || isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || isLoading}
                >
                  {form.formState.isSubmitting ? "Saving..." : "Save"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </AdminDialogContent>
    </AdminDialog>
  );
};

