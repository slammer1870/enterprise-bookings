import React from "react";

import { LessonList } from "./lesson-list";

import { BasePayload } from "payload";

import { getLessons } from "../../data/lessons";

export const FetchLessons: React.FC<{
  params: any;
  searchParams: { [key: string]: string | string[] | undefined };
  payload: BasePayload;
}> = async ({ searchParams, payload, params }) => {
  const lessons = await getLessons(payload, searchParams, params);

  return <LessonList lessons={lessons} />;
};
