import { TRPCError } from "@trpc/server";
import type { CollectionSlug } from "payload";

/**
 * Helper function to check if a collection exists in the Payload instance
 */
export function hasCollection(payload: any, collectionSlug: string): boolean {
  try {
    const collections = payload.config?.collections || [];

    const found = collections.some(
      (col: any) => col?.slug === collectionSlug || col === collectionSlug
    );
    if (!found) {
      console.log(
        `Collection "${collectionSlug}" not found. Available collections:`,
        collections.map((col: any) => col?.slug || col)
      );
    }
    return found;
  } catch (error) {
    console.error(`Error checking for collection "${collectionSlug}":`, error);
    return false;
  }
}

/**
 * Middleware to ensure required collections exist before executing a procedure
 * This prevents errors when an app doesn't have certain collections
 *
 * @example
 * const procedure = protectedProcedure
 *   .use(requireCollections("bookings", "lessons"))
 *   .input(...)
 *   .query(...)
 */
export function requireCollections(...collectionSlugs: string[]) {
  return async ({ ctx, next }: any) => {
    // Check each required collection
    const missingCollections: string[] = [];

    for (const slug of collectionSlugs) {
      if (!hasCollection(ctx.payload, slug)) {
        missingCollections.push(slug);
      }
    }

    if (missingCollections.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `The following collections are not available in this application: ${missingCollections.join(", ")}`,
      });
    }

    return next();
  };
}

/**
 * Helper function to safely access a collection, throwing an error if it doesn't exist
 */
export async function findByIdSafe<T>(
  payload: any,
  collectionSlug: string,
  id: number | string,
  options: {
    depth?: number;
    overrideAccess?: boolean;
    user?: any;
  } = {}
): Promise<T | null> {
  if (!hasCollection(payload, collectionSlug)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Collection "${collectionSlug}" is not available in this application`,
    });
  }

  try {
    return (await payload.findByID({
      collection: collectionSlug as CollectionSlug,
      id,
      depth: options.depth ?? 0,
      overrideAccess: options.overrideAccess ?? false,
      user: options.user,
    })) as unknown as T | null;
  } catch (error: any) {
    // If it's a not found error, return null
    if (error?.statusCode === 404 || error?.message?.includes("not found")) {
      return null;
    }
    throw error;
  }
}

/**
 * Helper function to safely find documents in a collection
 * @template T - The expected type of the documents returned
 */
export async function findSafe<T = any>(
  payload: any,
  collectionSlug: string,
  options: {
    where?: any;
    limit?: number;
    depth?: number;
    overrideAccess?: boolean;
    user?: any;
    sort?: string;
  } = {}
): Promise<{
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page?: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage?: number | null;
  nextPage?: number | null;
}> {
  if (!hasCollection(payload, collectionSlug)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Collection "${collectionSlug}" is not available in this application`,
    });
  }

  return (await payload.find({
    collection: collectionSlug as CollectionSlug,
    where: options.where,
    limit: options.limit,
    depth: options.depth ?? 0,
    overrideAccess: options.overrideAccess ?? false,
    user: options.user,
    ...(options.sort && { sort: options.sort }),
  })) as Promise<{
    docs: T[];
    totalDocs: number;
    limit: number;
    totalPages: number;
    page?: number;
    pagingCounter: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    prevPage?: number | null;
    nextPage?: number | null;
  }>;
}

/**
 * Helper function to safely create a document in a collection
 * @template T - The expected type of the created document
 */
export async function createSafe<T = any>(
  payload: any,
  collectionSlug: string,
  data: any,
  options: {
    depth?: number;
    overrideAccess?: boolean;
    user?: any;
  } = {}
): Promise<T> {
  if (!hasCollection(payload, collectionSlug)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Collection "${collectionSlug}" is not available in this application`,
    });
  }

  try {
    return (await payload.create({
      collection: collectionSlug as CollectionSlug,
      data,
      depth: options.depth ?? 0,
      overrideAccess: options.overrideAccess ?? false,
      user: options.user,
      showHiddenFields: false,
    })) as T;
  } catch (error: any) {
    // Handle the specific error about missing join fields (like "lessons")
    // This can happen when Payload tries to process join fields that don't exist in the schema
    // The field might be commented out but Payload still tries to process it
    const errorMessage = error?.message || error?.cause?.message || "";
    if (errorMessage.includes("Cannot find field for path")) {
      // Log the error for debugging but provide a more helpful error message
      console.error(
        `Payload error creating ${collectionSlug}:`,
        errorMessage,
        "\nThis may be due to a commented-out join field in the collection schema."
      );

      // Re-throw with a more helpful error message
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to create ${collectionSlug}. This may be due to a schema configuration issue with join fields.`,
        cause: error,
      });
    }
    throw error;
  }
}

/**
 * Helper function to safely update a document in a collection
 * @template T - The expected type of the updated document
 */
export async function updateSafe<T = any>(
  payload: any,
  collectionSlug: string,
  id: number | string,
  data: any,
  options: {
    depth?: number;
    overrideAccess?: boolean;
    user?: any;
  } = {}
): Promise<T> {
  if (!hasCollection(payload, collectionSlug)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Collection "${collectionSlug}" is not available in this application`,
    });
  }

  return (await payload.update({
    collection: collectionSlug as CollectionSlug,
    id,
    data,
    depth: options.depth ?? 0,
    overrideAccess: options.overrideAccess ?? false,
    user: options.user,
  })) as T;
}
