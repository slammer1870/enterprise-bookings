"use client";

import { useRowLabel } from "@payloadcms/ui";

export const DayRowLabel = () => {
  const { rowNumber } = useRowLabel<{ title?: string }>();

  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  // Convert rowNumber to day of week (rowNumber starts at 0)
  const dayIndex = (rowNumber ?? 0) % 7;
  const dayName = daysOfWeek[dayIndex];

  return <div>{dayName}</div>;
};
