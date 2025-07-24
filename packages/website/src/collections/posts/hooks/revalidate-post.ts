import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";

import { revalidatePath, revalidateTag } from "next/cache";

import type { Post } from "@repo/shared-types";

export const revalidatePost: CollectionAfterChangeHook<Post> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    revalidatePath("/");
    revalidateTag("posts-sitemap");
  }
  return doc;
};

export const revalidateDelete: CollectionAfterDeleteHook<Post> = ({
  doc,
  req: { context },
}) => {
  if (!context.disableRevalidate) {
    revalidatePath("/");
    revalidateTag("posts-sitemap");
  }

  return doc;
};
