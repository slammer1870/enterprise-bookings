"use client";

import { useEffect, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { Calendar } from "@repo/ui/components/ui/calendar";

import { Button } from "@repo/ui/components/ui/button";
import { CalendarIcon, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";
import { format } from "date-fns";

import { getLessonsQuery } from "@repo/shared-utils";

import { useTransition } from "react";

export const DatePicker = () => {
  const router = useRouter();
  const pathname = usePathname();

  const [date, setDate] = useState<Date | undefined>(new Date());

  const query = getLessonsQuery(date || new Date());

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      router.push(pathname + query);
    });
  }, [date]);

  return (
    <>
      <div className="hidden md:block relative">
        {isPending && (
          <div className="w-full h-full absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg opacity-25">
            <Loader2 className="animate-spin w-24 h-24" />
          </div>
        )}
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          defaultMonth={date}
          showOutsideDays
          required
        />
      </div>
      <div className="py-4 md:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[280px] justify-start bg-white text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            {isPending && (
              <div className="w-full h-full absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg opacity-25">
                <Loader2 className="animate-spin w-24 h-24" />
              </div>
            )}
            <Calendar
              selected={date}
              onSelect={setDate}
              mode="single"
              defaultMonth={date}
              showOutsideDays
              required
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
};
