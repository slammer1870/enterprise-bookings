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
    if (doc._status === "published") {
      const path = `/blog`;

      payload.logger.info(`Revalidating post at path: ${path}`);

      revalidatePath(path);
      revalidateTag("posts");
      revalidateTag("posts-sitemap");
    }

    // If the post was previously published, we need to revalidate the old path
    if (previousDoc._status === "published" && doc._status !== "published") {
      const oldPath = `/blog/${previousDoc.slug}`;

      payload.logger.info(`Revalidating old post at path: ${oldPath}`);

      revalidatePath(oldPath);
      revalidateTag("posts");
      revalidateTag("posts-sitemap");
    }
  }
  return doc;
};

export const revalidateDelete: CollectionAfterDeleteHook<Post> = ({
  doc,
  req: { context },
}) => {
  if (!context.disableRevalidate) {
    const path = `/blog`;

    revalidatePath(path);
    revalidateTag("posts");
    revalidateTag("posts-sitemap");
  }

  return doc;
};
