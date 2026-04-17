import * as qs from "qs";

import { getDayBoundsInTimeZone } from "./timezone";

export type GetTimeslotsQueryOptions = {
  /**
   * REST / admin URL population depth.
   * Use `0` for Payload admin timeslots list URLs so the query string matches the shallow
   * list path (custom list + ListQuery). Default `3` keeps `/api/timeslots` and schedule
   * fetches populated for public UI.
   */
  depth?: number;
};

export const getTimeslotsQuery = (
  date: Date,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  options?: GetTimeslotsQueryOptions,
) => {
  const { startOfDay, endOfDay } = getDayBoundsInTimeZone(date, timeZone);

  const query = {
    depth: options?.depth ?? 3,
    limit: "100",
    where: {
      or: [
        {
          and: [
            {
              startTime: {
                greater_than_equal: startOfDay.toISOString(),
              },
            },
            {
              startTime: {
                less_than_equal: endOfDay.toISOString(),
              },
            },
          ],
        },
      ],
    },
    sort: "startTime",
  };

  const stringifiedQuery = qs.stringify(query, {
    addQueryPrefix: true,
    encode: false,
  });

  return stringifiedQuery;
};

export const getBookingsQuery = (
  userId: number | undefined,
  lessonId: number
) => {
  const query = {
    depth: 2,
    limit: 1,
    where: {
      and: [{ lesson: { equals: lessonId } }, { user: { equals: userId } }],
    },
  };

  const stringifiedQuery = qs.stringify(query, { addQueryPrefix: true });

  return stringifiedQuery;
};

export const getActiveBookingsQuery = (
  userId: number | undefined,
  lessonId: number
) => {
  const query = {
    depth: 2,
    limit: 1,
    where: {
      and: [
        { lesson: { equals: lessonId } },
        { user: { equals: userId } },
        {
          status: {
            equals: "confirmed",
          },
        },
      ],
    },
  };

  const stringifiedQuery = qs.stringify(query, { addQueryPrefix: true });

  return stringifiedQuery;
};

export const getInactiveBookingsQuery = (
  userId: number | undefined,
  lessonId: number
) => {
  const query = {
    depth: 2,
    limit: 1,
    where: {
      and: [
        { lesson: { equals: lessonId } },
        { user: { equals: userId } },
        {
          status: {
            not_equals: "confirmed",
          },
        },
      ],
    },
  };

  const stringifiedQuery = qs.stringify(query, { addQueryPrefix: true });

  return stringifiedQuery;
};
