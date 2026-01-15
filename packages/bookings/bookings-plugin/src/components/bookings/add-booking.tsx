"use client";

import { useForm } from "react-hook-form";

import { useEffect, useState } from "react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";

import { Button } from "@repo/ui/components/ui/button";

import { User } from "@repo/shared-types";

import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useRouter } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/ui/command";

export const AddBooking = ({ lessonId }: { lessonId: number }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const fetchUsers = async (): Promise<User[]> => {
      try {
        setIsLoading(true);
        const usersResponse = await fetch(`/api/users?limit=10000`, {
          credentials: "include",
        });
        const usersData = await usersResponse.json();
        setUsers(usersData.docs);
        setIsLoading(false);
        return usersData;
      } catch (error) {
        console.error(error);
        setIsLoading(false);
        return [];
      }
    };
    fetchUsers();
  }, []);

  const FormData = z.object({
    user: z.string(),
  });

  type FormSchema = z.infer<typeof FormData>;

  const form = useForm<FormSchema>({
    resolver: zodResolver(FormData),
    defaultValues: {
      user: "",
    },
  });

  const onSubmit = async (data: FormSchema) => {
    const response = await fetch(`/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user: Number(data.user),
        lesson: lessonId,
        status: "pending",
      }),
      credentials: "include",
    });

    const { errors } = await response.json();

    if (errors) {
      return toast.error(errors[0].message || "An error occurred");
    }

    toast.success("Booking added successfully");
    form.reset();
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2 my-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 flex items-end justify-between"
        >
          <FormField
            control={form.control}
            name="user"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Select User</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between text-xs",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value
                          ? users?.find(
                              (user) => user.id.toString() === field.value
                            )?.email
                          : "Select user"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search user..."
                        className="border-none"
                      />
                      <CommandList>
                        <CommandEmpty>No user found.</CommandEmpty>
                        <CommandGroup>
                          {users?.map((user) => (
                            <CommandItem
                              value={`${user.name} - ${user.email}`}
                              key={user.id}
                              onSelect={() => {
                                form.setValue("user", user.id.toString());
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  user.id.toString() === field.value
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {user.name} - {user.email}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end space-x-2">
            <Button type="submit" size="sm" disabled={isLoading}>
              Add Booking
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
