"use server";

import { Lesson } from "@repo/shared-types";

import { cookies } from "next/headers";
import { getLessonsQuery } from "../utils/query";

export async function getLessons(date: Date) {
  const cookieStore = await cookies();
  const token = cookieStore.get("payload-token")?.value;

  const query = getLessonsQuery(date);

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/lessons${query}`,
    {
      method: "GET",
      headers: {
        Authorization: `JWT ${token}`,
      },
    }
  );

  const data = await response.json();

  return data.docs as Lesson[];
}
