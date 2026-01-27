import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";

import { revalidatePath, revalidateTag } from "../utils/next-cache";

import type { Page } from "@repo/shared-types";

export const revalidatePage: CollectionAfterChangeHook<Page> = async ({
  doc,
  previousDoc: _previousDoc,
  req: { payload, context: _context },
}) => {
  if (!_context.disableRevalidate) {
    const path = doc.slug === "home" ? "/" : `/${doc.slug}`;

    payload.logger.info(`Revalidating page at path: ${path}`);

    // Use process.nextTick to defer revalidation until after the current execution context
    process.nextTick(async () => {
      await revalidatePath(path);

      // If the slug changed, also revalidate the old slug path
      if (_previousDoc && _previousDoc.slug !== doc.slug) {
        await revalidatePath(`/${_previousDoc.slug}`);
      }

      await revalidateTag("pages-sitemap");
    });

    _context.disableRevalidate = true;
  }

  return doc;
};

export const revalidateDelete: CollectionAfterDeleteHook<Page> = async ({
  doc,
  req: { context: _context },
}) => {
  if (!_context.disableRevalidate) {
    const path = doc?.slug === "home" ? "/" : `/${doc?.slug}`;
    
    // Use process.nextTick to defer revalidation until after the current execution context
    process.nextTick(async () => {
      await revalidatePath(path);
      await revalidateTag("pages-sitemap");
    });

    _context.disableRevalidate = true;
  }

  return doc;
};
