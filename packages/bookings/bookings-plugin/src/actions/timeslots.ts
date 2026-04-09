"use server";

import { Timeslot } from "@repo/shared-types";

import { cookies } from "next/headers";
import { getTimeslotsQuery } from "../utils/query";

export async function getTimeslots(date: Date) {
  const cookieStore = await cookies();
  const token = cookieStore.get("payload-token")?.value;

  const query = getTimeslotsQuery(date);

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/timeslots${query}`,
    {
      method: "GET",
      headers: {
        Authorization: `JWT ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.log(error);
    throw new Error(error.message);
  }

  const data = await response.json();

  return data.docs as Timeslot[];
}
