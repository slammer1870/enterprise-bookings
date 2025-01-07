"use client";

import { useEffect, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { Calendar } from "./calendar";

import { Button } from "./button";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "@repo/ui/lib/utils";
import { format } from "date-fns";

import { getLessonsQuery } from "@repo/shared-utils";

export const DatePicker = () => {
  const router = useRouter();
  const pathname = usePathname();

  const [date, setDate] = useState<Date | undefined>(new Date());

  const query = getLessonsQuery(date || new Date());

  useEffect(() => {
    router.push(pathname + query);
  }, [date]);

  return (
    <>
      <div className="hidden md:block">
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
