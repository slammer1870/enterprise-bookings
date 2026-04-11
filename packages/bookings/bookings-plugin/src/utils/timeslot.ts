import { Timeslot } from "@repo/shared-types";

export const getTimeslot = async (timeslotId: string): Promise<Timeslot> => {
  const request = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/timeslots/${timeslotId}`
  );

  const timeslot = await request.json();

  return timeslot;
};
