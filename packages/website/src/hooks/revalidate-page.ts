import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";

import { revalidatePath, revalidateTag } from "next/cache";

import type { Page } from "@repo/shared-types";

export const revalidatePage: CollectionAfterChangeHook<Page> = ({
  doc,
  previousDoc: _previousDoc,
  req: { payload, context: _context },
}) => {
  if (!_context.disableRevalidate) {
    const path = doc.slug === "home" ? "/" : `/${doc.slug}`;

    payload.logger.info(`Revalidating page at path: ${path}`);

    // Use process.nextTick to defer revalidation until after the current execution context
    process.nextTick(() => {
      revalidatePath(path);

      // If the slug changed, also revalidate the old slug path
      if (_previousDoc && _previousDoc.slug !== doc.slug) {
        revalidatePath(`/${_previousDoc.slug}`);
      }

      revalidateTag("pages-sitemap");
    });

    _context.disableRevalidate = true;
  }

  return doc;
};

export const revalidateDelete: CollectionAfterDeleteHook<Page> = ({
  doc,
  req: { context: _context },
}) => {
  if (!_context.disableRevalidate) {
    const path = doc?.slug === "home" ? "/" : `/${doc?.slug}`;
    
    // Use process.nextTick to defer revalidation until after the current execution context
    process.nextTick(() => {
      revalidatePath(path);
      revalidateTag("pages-sitemap");
    });

    _context.disableRevalidate = true;
  }

  return doc;
};
