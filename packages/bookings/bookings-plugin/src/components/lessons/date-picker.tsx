"use client";

import { Suspense, useEffect, useMemo, useState, useTransition } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

function DatePickerInner({ selectedDateISO }: { selectedDateISO?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  /**
   * When the day filter is already in the URL, `selectedDateISO` is set and the effect below
   * that applies the default query never runs—so bookmarks / old links can keep `depth=3`.
   * Payload’s ListQueryProvider and the Next RSC segment key both mirror that param; normalize
   * it without touching `where`, `limit`, or `sort`.
   */
  useEffect(() => {
    // When there is no day filter yet, the effect below replaces the whole query with
    // `getTimeslotsQuery(..., { depth: 0 })`—skip this to avoid two navigations.
    if (!selectedDateISO) return;
    if (searchParams.get("depth") === "0") return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("depth", "0");
    const qs = params.toString();

    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }, [pathname, router, searchParams, selectedDateISO]);

  useEffect(() => {
    if (selectedDateISO) return;

    startTransition(() => {
      router.replace(
        pathname + getTimeslotsQuery(selectedDateFromUrl, undefined, { depth: 0 }),
      );
    });
  }, [pathname, router, selectedDateFromUrl, selectedDateISO]);

  const handleSelect = (nextDate: Date | undefined) => {
    if (!nextDate) return;
    setDate(nextDate);
    setMonth(nextDate);
    startTransition(() => {
      router.push(pathname + getTimeslotsQuery(nextDate, undefined, { depth: 0 }));
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
}

export const DatePicker = (props: { selectedDateISO?: string }) => (
  <Suspense fallback={null}>
    <DatePickerInner {...props} />
  </Suspense>
);
