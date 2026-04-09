"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { usePathname, useRouter } from "next/navigation";

import { Calendar } from "@repo/ui/components/ui/calendar";

import { Button } from "@repo/ui/components/ui/button";
import { CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";
import { format } from "date-fns";

import { getTimeslotsQuery } from "@repo/shared-utils/query";

function parseSelectedDate(selectedDateISO?: string): Date {
  if (!selectedDateISO) return new Date();

  const parsed = new Date(selectedDateISO);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function isSameCalendarDay(left?: Date, right?: Date) {
  if (!left || !right) return false;

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export const DatePicker = ({ selectedDateISO }: { selectedDateISO?: string }) => {
  const router = useRouter();
  const pathname = usePathname();

  const selectedDateFromUrl = useMemo(
    () => parseSelectedDate(selectedDateISO),
    [selectedDateISO],
  );
  const [date, setDate] = useState<Date | undefined>(selectedDateFromUrl);
  const [month, setMonth] = useState<Date>(selectedDateFromUrl);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDate((currentDate) =>
      isSameCalendarDay(currentDate, selectedDateFromUrl) ? currentDate : selectedDateFromUrl,
    );
    setMonth(selectedDateFromUrl);
  }, [selectedDateFromUrl]);

  useEffect(() => {
    if (selectedDateISO) return;

    startTransition(() => {
      router.replace(pathname + getTimeslotsQuery(selectedDateFromUrl));
    });
  }, [pathname, router, selectedDateFromUrl, selectedDateISO]);

  const handleSelect = (nextDate: Date | undefined) => {
    if (!nextDate) return;
    setDate(nextDate);
    setMonth(nextDate);
    startTransition(() => {
      router.push(pathname + getTimeslotsQuery(nextDate));
    });
  };

  return (
    <>
      <div className="hidden md:block">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          month={month}
          onMonthChange={setMonth}
          showOutsideDays
          required
          disabled={isPending}
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
              onSelect={handleSelect}
              mode="single"
              month={month}
              onMonthChange={setMonth}
              showOutsideDays
              required
              initialFocus
              disabled={isPending}
            />
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
};
