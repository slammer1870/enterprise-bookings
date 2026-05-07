import { z } from "zod";
import type { Where } from "payload";

import { publicProcedure, hasCollection } from "../trpc";

/**
 * Shared, app-agnostic content fetching for multi-tenant Payload apps.
 *
 * Important: multi-tenant semantics for atnd-me are implemented by passing `tenantId`
 * from the app (correctness-first). Root domain passes `tenantId: null`.
 */
export const contentRouter = {
  pages: {
    bySlug: publicProcedure
      .input(
        z.object({
          slug: z.string().min(1),
          draft: z.boolean(),
          tenantId: z.number().int().nullable(),
        })
      )
      .query(async ({ ctx, input }) => {
        if (!hasCollection(ctx.payload, "pages")) return null;

        const overrideAccess = input.draft || input.tenantId == null;
        const req =
          input.tenantId != null
          ? ({
              payload: ctx.payload,
              headers: ctx.headers,
              context: { tenant: input.tenantId },
            } as any)
            : undefined;

        const where: Where = {
          slug: { equals: input.slug },
          ...(input.tenantId != null
            ? { tenant: { equals: input.tenantId } }
            : { tenant: { equals: null } }),
        };

        const result = await ctx.payload.find({
          collection: "pages",
          draft: input.draft,
          depth: 2,
          limit: 1,
          pagination: false,
          overrideAccess,
          ...(req ? { req } : {}),
          where,
        });

        return result.docs?.[0] ?? null;
      }),
  },

  posts: {
    bySlug: publicProcedure
      .input(
        z.object({
          slug: z.string().min(1),
          draft: z.boolean(),
          tenantId: z.number().int().nullable(),
        })
      )
      .query(async ({ ctx, input }) => {
        if (!hasCollection(ctx.payload, "posts")) return null;

        const overrideAccess = input.draft || input.tenantId == null;
        const req =
          input.tenantId != null
          ? ({
              payload: ctx.payload,
              headers: ctx.headers,
              context: { tenant: input.tenantId },
            } as any)
            : undefined;

        const where: Where = {
          slug: { equals: input.slug },
          ...(input.tenantId != null
            ? { tenant: { equals: input.tenantId } }
            : { tenant: { equals: null } }),
        };

        const result = await ctx.payload.find({
          collection: "posts",
          draft: input.draft,
          depth: 2,
          limit: 1,
          pagination: false,
          overrideAccess,
          ...(req ? { req } : {}),
          where,
        });

        return result.docs?.[0] ?? null;
      }),

    archive: publicProcedure
      .input(
        z.object({
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).optional(),
          draft: z.boolean(),
          tenantId: z.number().int().nullable(),
        })
      )
      .query(async ({ ctx, input }) => {
        if (!hasCollection(ctx.payload, "posts")) {
          return {
            docs: [],
            page: input.page ?? 1,
            totalPages: 0,
            totalDocs: 0,
            limit: input.limit ?? 12,
          };
        }

        const DEFAULT_LIMIT = 12;
        const page = input.page ?? 1;
        const limit = input.limit ?? DEFAULT_LIMIT;

        const overrideAccess = input.draft || input.tenantId == null;
        const req =
          input.tenantId != null
          ? ({
              payload: ctx.payload,
              headers: ctx.headers,
              context: { tenant: input.tenantId },
            } as any)
            : undefined;

        const where: Where = {
          ...(input.tenantId != null
            ? { tenant: { equals: input.tenantId } }
            : { tenant: { equals: null } }),
        };

        return ctx.payload.find({
          collection: "posts",
          draft: input.draft,
          depth: 1,
          limit,
          page,
          pagination: true,
          overrideAccess,
          ...(req ? { req } : {}),
          where,
          sort: "-publishedAt",
          select: {
            title: true,
            slug: true,
            categories: true,
            meta: true,
          },
        });
      }),
  },
} as const;

