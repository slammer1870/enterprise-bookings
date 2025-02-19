import { useEffect, useState } from "react";

import { Lesson } from "../types";

import { getLessonsQuery } from "@repo/shared-utils";

export const useSchedule = (date: Date) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const query = getLessonsQuery(date);

  useEffect(() => {
    const fetchLessons = async () => {
      setIsLoading(true);
      const data = await fetch(`/api/lessons${query}`, {
        method: "GET",
      });

      const lessons = await data.json();

      setLessons(lessons.docs);
      setIsLoading(false);
    };

    fetchLessons();
  }, [date]);

  return {
    lessons: lessons,
    isLoading: isLoading,
  };
};
