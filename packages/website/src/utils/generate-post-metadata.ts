import { Metadata } from "next";
import { CollectionSlug, Payload } from "payload";
import { Post } from "@repo/shared-types";

type Args = {
  params: Promise<{
    slug?: string;
  }>;
  payload: Payload;
};

export async function generatePostMetadataFunction({
  params: paramsPromise,
  payload,
}: Args): Promise<Metadata> {
  const { slug = "home" } = await paramsPromise;

  const result = await payload.find({
    collection: "posts" as CollectionSlug,
    limit: 1,
    where: {
      slug: {
        equals: slug,
      },
    },
  });

  const post = result.docs?.[0] as Post | undefined;

  if (!post) {
    return {
      title: "Not Found",
      description: "The page you are looking for does not exist.",
    };
  }

  return {
    title: post.meta?.title || post.title,
    description: post.meta?.description,
    openGraph: {
      title: post.meta?.title || post.title,
      description: post.meta?.description || "",
      images:
        post.meta?.image && typeof post.meta.image === "object"
          ? [{ url: post.meta.image.url || "" }]
          : [],
    },
    metadataBase: process.env.NEXT_PUBLIC_SERVER_URL
      ? new URL(process.env.NEXT_PUBLIC_SERVER_URL)
      : undefined,
  };
}
