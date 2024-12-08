import { AuthStrategy, AuthStrategyResult, Payload } from "payload";

import jwt from "jsonwebtoken";

export const magicLink: AuthStrategy = {
  name: "magic-link",
  authenticate: async ({
    payload,
    headers,
  }: {
    payload: Payload;
    headers: Headers;
  }) => {
    const token = headers.get("token");

    if (!token) {
      return {
        user: null,
      };
    }

    try {
      const decoded = jwt.verify(token, payload.secret) as { id: string };

      // Create a Payload login response
      const user = await payload.findByID({
        collection: "users",
        id: decoded.id,
      });

      if (!user) {
        return {
          user: null,
        };
      }

      return {
        user: user as unknown as AuthStrategyResult["user"],
      };
    } catch (error) {
      console.log("error", error);
    }

    return {
      user: null,
    };
  },
};
