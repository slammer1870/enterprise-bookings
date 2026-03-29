import qs from "qs";

import { getDayBoundsInTimeZone } from "@repo/shared-utils";

export const getLessonsQuery = (
  date: Date,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) => {
  const { startOfDay, endOfDay } = getDayBoundsInTimeZone(date, timeZone);

  const query = {
    sort: "startTime",
    depth: 4,
    limit: "100",
    page: "1",
    where: {
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
  };

  const stringifiedQuery = qs.stringify(query, { addQueryPrefix: true });

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
