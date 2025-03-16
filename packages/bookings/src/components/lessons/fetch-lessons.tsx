import React from "react";

import Link from "next/link";

import { redirect } from "next/navigation";

import { DatePicker } from "@repo/ui/components/ui/date-picker";

import { Button } from "@payloadcms/ui";

import { Lesson } from "@repo/shared-types";

import { getLessonsQuery } from "@repo/shared-utils";

import { LessonList } from "./lesson-list";

import { Toaster } from "sonner";

import { BasePayload } from "payload";

import qs from "qs";

export const FetchLessons: React.FC<{
  params: any;
  searchParams: { [key: string]: string | string[] | undefined };
  payload: BasePayload;
}> = async ({ searchParams, payload, params }) => {
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

  return (
    <div className="mx-20">
      <div className="flex flex-row justify-start items-center mb-4 gap-6">
        <h1>Lessons</h1>
        <Link
          href={{
            pathname: "/admin/collections/lessons/create",
          }}
        >
          <Button buttonStyle="pill" className="whitespace-nowrap py-0">
            Create New
          </Button>
        </Link>
        <span className="w-full text-center font-medium text-lg hidden md:block"></span>
      </div>
      <div className="flex flex-col md:flex-row gap-8">
        <DatePicker />
        <LessonList lessons={lessons} />
      </div>
      <Toaster />
    </div>
  );
};
