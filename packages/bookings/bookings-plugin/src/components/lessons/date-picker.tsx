"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

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
  const didApplyDefaultDate = useRef(false);
  const prevSelectedDateISO = useRef(selectedDateISO);
  const [isPending, startTransition] = useTransition();

  const selectedDateFromUrl = useMemo(
    () => parseSelectedDate(selectedDateISO),
    [selectedDateISO],
  );
  const [date, setDate] = useState<Date | undefined>(selectedDateFromUrl);
  const [month, setMonth] = useState<Date>(selectedDateFromUrl);

  useEffect(() => {
    const previousISO = prevSelectedDateISO.current;
    prevSelectedDateISO.current = selectedDateISO;

    setDate((currentDate) =>
      isSameCalendarDay(currentDate, selectedDateFromUrl) ? currentDate : selectedDateFromUrl,
    );

    // Default-date replace (no filter → today) must not reset an intentional month change.
    if (previousISO == null && selectedDateISO != null) return;
    if (previousISO === selectedDateISO) return;
    if (isSameCalendarDay(parseSelectedDate(previousISO), selectedDateFromUrl)) return;

    setMonth(selectedDateFromUrl);
  }, [selectedDateFromUrl, selectedDateISO]);

  useEffect(() => {
    if (selectedDateISO) {
      didApplyDefaultDate.current = true;
      return;
    }
    if (didApplyDefaultDate.current) return;
    didApplyDefaultDate.current = true;

    startTransition(() => {
      router.replace(
        pathname + getTimeslotsQuery(selectedDateFromUrl, undefined, { depth: 0 }),
        { scroll: false },
      );
    });
  }, [pathname, router, selectedDateFromUrl, selectedDateISO]);

  const handleSelect = (nextDate: Date | undefined) => {
    if (!nextDate) return;
    if (isSameCalendarDay(nextDate, date)) return;
    setDate(nextDate);
    setMonth(nextDate);
    startTransition(() => {
      router.push(
        pathname + getTimeslotsQuery(nextDate, undefined, { depth: 0 }),
        { scroll: false },
      );
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
                "w-[280px] justify-start bg-background text-left font-normal",
                !date && "text-muted-foreground"
              )}
              disabled={isPending}
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
