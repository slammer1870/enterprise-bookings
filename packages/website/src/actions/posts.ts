"use server";

import type { Post } from "@repo/shared-types";

export const fetchLatestPosts = async () => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/posts?limit=3&sort=createdAt:desc`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      next: {
        tags: ["posts"],
      },
    }
  );
  const data = await response.json();

  return data.docs as Post[];
};
