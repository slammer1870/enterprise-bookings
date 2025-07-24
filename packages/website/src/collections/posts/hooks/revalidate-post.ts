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
      // Revalidate the blog listing page
      const blogPath = `/blog`;
      payload.logger.info(`Revalidating blog listing at path: ${blogPath}`);
      revalidatePath(blogPath);

      // Revalidate the individual post page if it has a slug
      if (doc.slug) {
        const postPath = `/blog/${doc.slug}`;
        payload.logger.info(`Revalidating post at path: ${postPath}`);
        revalidatePath(postPath);
      }

      revalidateTag("posts-sitemap");
    }

    // If the post was previously published, we need to revalidate the old paths
    if (previousDoc._status === "published" && doc._status !== "published") {
      // Revalidate the blog listing page
      const blogPath = `/blog`;
      payload.logger.info(`Revalidating blog listing at path: ${blogPath}`);
      revalidatePath(blogPath);

      // Revalidate the old post page if it had a slug
      if (previousDoc.slug) {
        const oldPostPath = `/blog/${previousDoc.slug}`;
        payload.logger.info(`Revalidating old post at path: ${oldPostPath}`);
        revalidatePath(oldPostPath);
      }

      revalidateTag("posts-sitemap");
    }

    // If the slug changed for a published post, revalidate both old and new paths
    if (
      doc._status === "published" &&
      previousDoc._status === "published" &&
      previousDoc.slug &&
      doc.slug &&
      previousDoc.slug !== doc.slug
    ) {
      const oldPostPath = `/blog/${previousDoc.slug}`;
      const newPostPath = `/blog/${doc.slug}`;
      
      payload.logger.info(`Revalidating old post path: ${oldPostPath}`);
      payload.logger.info(`Revalidating new post path: ${newPostPath}`);
      
      revalidatePath(oldPostPath);
      revalidatePath(newPostPath);
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
    // Revalidate the blog listing page
    const blogPath = `/blog`;
    revalidatePath(blogPath);

    // Revalidate the individual post page if it had a slug
    if (doc.slug) {
      const postPath = `/blog/${doc.slug}`;
      revalidatePath(postPath);
    }

    revalidateTag("posts-sitemap");
  }

  return doc;
};
