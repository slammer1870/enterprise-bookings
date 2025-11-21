import "server-only";

import { BasePayload } from "payload";
import { redirect } from "next/navigation";

import { getLessonsQuery } from "@repo/shared-utils";
import { Lesson } from "@repo/shared-types";

import qs from "qs";

export const getLessons = async (
  payload: BasePayload,
  searchParams: { [key: string]: string | string[] | undefined },
  params: any
) => {
  const startQuery = "where[or][0][and][0][startTime][greater_than_equal]";

  const condition = searchParams && searchParams[startQuery];

  if (!condition) {
    const query = getLessonsQuery(new Date());

    redirect(`/admin/collections/lessons${query}`);
  }

  const ps = qs.parse(searchParams as unknown as string, {
    ignoreQueryPrefix: true,
    depth: 6,
  });

  const searchQuery = { collection: params.segments[1], ...ps };

  const lessonList = await payload.find(searchQuery);

  const lessons = lessonList.docs as Lesson[];

  return lessons;
};
