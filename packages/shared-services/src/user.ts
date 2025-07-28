"use server";

import { generatePasswordSaltHash } from "@repo/shared-utils";

import * as crypto from "crypto";

import { stringify } from "qs-esm";
import type { Where } from "payload";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { User } from "@repo/shared-types";

const query: Where = {
  color: {
    equals: "mint",
  },
  // This query could be much more complex
  // and qs-esm would handle it beautifully
};

type GetOrCreateUserProps = {
  name: string;
  email: string;
};

export const getOrCreateUser = async ({
  name,
  email,
}: GetOrCreateUserProps): Promise<User | null> => {
  const query: Where = {
    email: {
      equals: email,
    },
  };

  const stringifiedQuery = stringify(
    {
      where: query, // ensure that `qs-esm` adds the `where` property, too!
    },
    { addQueryPrefix: true }
  );

  try {
    const userRequest = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/users${stringifiedQuery}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const user = await userRequest.json();

    if (user.docs.length === 0) {
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const { hash, salt } = await generatePasswordSaltHash({
        password: randomPassword,
      });

      const userResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/users`,
        {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            name: name,
            email: email,
            hash: hash,
            salt: salt,
            password: randomPassword,
          }),
        }
      );

      return await userResponse.json();
    }

    return user.docs[0];
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const getMeUser = async (args?: {
  nullUserRedirect?: string;
  validUserRedirect?: string;
}): Promise<{
  token?: string;
  user: User;
}> => {
  const { nullUserRedirect, validUserRedirect } = args || {};
  const cookieStore = await cookies();
  const token = cookieStore.get("payload-token")?.value;

  const meUserReq = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/me`,
    {
      headers: {
        Authorization: `JWT ${token}`,
      },
    }
  );

  const {
    user,
  }: {
    user: User;
  } = await meUserReq.json();

  if (validUserRedirect && meUserReq.ok && user) {
    redirect(validUserRedirect);
  }

  if (nullUserRedirect && (!meUserReq.ok || !user)) {
    redirect(nullUserRedirect);
  }

  return {
    token,
    user,
  };
};
