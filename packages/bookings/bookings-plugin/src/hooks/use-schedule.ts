import { useEffect, useState } from "react";

import { Timeslot } from "@repo/shared-types";

import { getTimeslotsQuery } from "@repo/shared-utils/query";

export const useSchedule = (date: Date) => {
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const query = getTimeslotsQuery(date);

  useEffect(() => {
    const fetchTimeslots = async () => {
      setIsLoading(true);
      const data = await fetch(`/api/timeslots${query}`, {
        method: "GET",
      });

      const timeslots = await data.json();

      setTimeslots(timeslots.docs);
      setIsLoading(false);
    };

    fetchTimeslots();
  }, [date]);

  return {
    timeslots: timeslots,
    isLoading: isLoading,
  };
};
