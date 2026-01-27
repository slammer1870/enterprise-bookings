import React from "react";

import { LessonList } from "./lesson-list";

import { BasePayload, PayloadRequest } from "payload";

import { getLessons } from "../../data/lessons";

export const FetchLessons: React.FC<{
  params: any;
  searchParams: { [key: string]: string | string[] | undefined };
  payload: BasePayload;
  req?: PayloadRequest;
}> = async ({ searchParams, payload, params, req }) => {
  const lessons = await getLessons(payload, searchParams, params, req);

  return <LessonList lessons={lessons} />;
};
