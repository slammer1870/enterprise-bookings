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
  // Set disableRevalidate to true to disable revalidation

  if (!context.disableRevalidate) {
    // Use process.nextTick to defer revalidation until after the current execution context
    process.nextTick(() => {
      // Revalidate homepage
      revalidatePath("/[slug]");

      // Revalidate main blog page
      revalidatePath("/blog");

      // Revalidate the specific post page
      revalidatePath(`/blog/${doc.slug}`);

      // If the slug changed, also revalidate the old slug path
      if (previousDoc && previousDoc.slug !== doc.slug) {
        revalidatePath(`/blog/${previousDoc.slug}`);
      }

      // Revalidate sitemap
      revalidateTag("posts-sitemap");
    });

    context.disableRevalidate = true;
  }
  return doc;
};

export const revalidateDelete: CollectionAfterDeleteHook<Post> = ({
  doc,
  req: { context },
}) => {
  // Set disableRevalidate to true to disable revalidation

  if (!context.disableRevalidate) {
    // Use process.nextTick to defer revalidation until after the current execution context
    process.nextTick(() => {
      // Revalidate homepage
      revalidatePath("/[slug]");

      // Revalidate main blog page
      revalidatePath("/blog");

      // Revalidate the deleted post page (to show 404)
      revalidatePath(`/blog/${doc.slug}`);

      // Revalidate sitemap
      revalidateTag("posts-sitemap");
    });

    context.disableRevalidate = true;
  }

  return doc;
};
