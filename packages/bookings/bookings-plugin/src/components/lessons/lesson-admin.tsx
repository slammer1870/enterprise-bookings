import React, { Suspense } from "react";

import Link from "next/link";

import { DatePicker } from "./date-picker";

import { Button, Gutter } from "@payloadcms/ui";

import { Toaster } from "sonner";

import { BasePayload } from "payload";

import { LessonLoading } from "./lesson-loading";
import { FetchLessons } from "./fetch-lessons";

export const LessonAdmin: React.FC<{
  params: any;
  searchParams: { [key: string]: string | string[] | undefined };
  payload: BasePayload;
}> = async ({ searchParams, payload, params }) => {
  return (
    <Gutter>
      <div className="flex flex-row justify-start items-center mb-4 gap-3">
        <h1>Lessons</h1>
        <Link
          href={{
            pathname: "/admin/collections/lessons/create",
          }}
        >
          <Button buttonStyle="pill" size="small" className="whitespace-nowrap">
            Create New
          </Button>
        </Link>
        <span className="w-full text-center font-medium text-lg hidden md:block"></span>
      </div>
      <div className="flex flex-col md:flex-row">
        <div className="mb-8 md:mb-0 md:mr-8">
          <DatePicker />
        </div>
        <div className="flex flex-col w-full">
          <Suspense
            key={
              searchParams[
                "where[or][0][and][0][startTime][greater_than_equal]"
              ] as string
            }
            fallback={<LessonLoading />}
          >
            <FetchLessons
              payload={payload}
              searchParams={searchParams}
              params={params}
            />
          </Suspense>
        </div>
      </div>
      <Toaster />
    </Gutter>
  );
};
