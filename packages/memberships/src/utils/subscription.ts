import "server-only";

import { Subscription } from "@repo/shared-types";

import { getMeUser } from "@repo/shared-services";

import qs from "qs";

const query = {
  depth: 3,
  limit: "1",
  where: {
    startDate: {
      less_than_equal: new Date().toISOString(),
    },
    endDate: {
      greater_than_equal: new Date().toISOString(),
    },
    status: {
      not_equals: "canceled",
    },
  },
};

const stringifiedQuery = qs.stringify(query, {
  addQueryPrefix: true,
  encode: false,
});

export const getActiveSubscription = async (): Promise<Subscription | null> => {
  const { token } = await getMeUser();

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/subscriptions${stringifiedQuery}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const data = await response.json();

  return data.docs[0];
};
