import React from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { DatePicker } from "@repo/ui/components/ui/date-picker";

import { Button } from "@payloadcms/ui";

import { Lesson } from "../../types";

import { getLessonsQuery } from "@repo/shared-utils";

import { LessonList } from "./lesson-list";

import { Toaster } from "sonner";

export const FetchLessons: React.FC<{
  data: any;
  searchParams: { [key: string]: string | string[] | undefined };
}> = ({ data, searchParams }) => {
  const searchQuery = "where[or][0][and][0][start_time][greater_than_equal]";

  const condition = searchParams && searchParams[searchQuery];

  if (!condition) {
    const query = getLessonsQuery(new Date());

    redirect(`/admin/collections/lessons${query}`);
  }

  const lessons = data.docs as Lesson[];

  return (
    <div className=" mx-20">
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
