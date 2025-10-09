import "server-only";

import { Subscription } from "@repo/shared-types";

import { getMeUser } from "@repo/shared-services";

import qs from "qs";

export const getActiveSubscription = async (): Promise<Subscription | null> => {
  const { token, user } = await getMeUser();

  const query = {
    depth: 3,
    limit: "1",
    where: {
      and: [
        {
          startDate: {
            less_than_equal: new Date().toISOString(),
          },
        },
        {
          endDate: {
            greater_than_equal: new Date().toISOString(),
          },
        },
        {
          status: {
            status: {
              not_in: [
                "canceled",
                "unpaid",
                "incomplete_expired",
                "incomplete",
              ],
            },
          },
        },
        {
          user: {
            equals: user?.id,
          },
        },
      ],
    },
  };

  const stringifiedQuery = qs.stringify(query, {
    addQueryPrefix: true,
    encode: false,
  });

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

export const getActiveChildSubscription =
  async (): Promise<Subscription | null> => {
    const { token, user } = await getMeUser();

    const query = {
      depth: 3,
      limit: "1",
      where: {
        and: [
          {
            startDate: {
              less_than_equal: new Date().toISOString(),
            },
          },
          {
            endDate: {
              greater_than_equal: new Date().toISOString(),
            },
          },
          {
            status: {
              not_in: [
                "canceled",
                "unpaid",
                "incomplete_expired",
                "incomplete",
              ],
            },
          },
          {
            "plan.type": {
              equals: "child",
            },
          },
          {
            user: {
              equals: user?.id,
            },
          },
        ],
      },
    };

    const stringifiedQuery = qs.stringify(query, {
      addQueryPrefix: true,
      encode: false,
    });

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/subscriptions${stringifiedQuery}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data = await response.json();

    return data.docs[0] || null;
  };
