import React from "react";

import { LessonsListWithSelection } from "./lessons-list-with-selection";

import { BasePayload, PayloadRequest } from "payload";

import { getLessons } from "../../data/lessons";
import { getLessonStartTimeFilter } from "../../utils/lesson-search-params";

export const FetchLessons: React.FC<{
  params: any;
  searchParams: { [key: string]: string | string[] | undefined };
  payload: BasePayload;
  req?: PayloadRequest;
}> = async ({ searchParams, payload, params, req }) => {
  const lessons = await getLessons(payload, searchParams, params, req);
  const listKey = getLessonStartTimeFilter(searchParams) || "default";

  return <LessonsListWithSelection lessons={lessons} listKey={listKey} />;
};
