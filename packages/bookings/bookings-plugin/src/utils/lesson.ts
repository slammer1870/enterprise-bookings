import { Lesson } from "@repo/shared-types";

export const getLesson = async (lessonId: string): Promise<Lesson> => {
  const request = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/lessons/${lessonId}`
  );

  const lesson = await request.json();

  return lesson;
};
