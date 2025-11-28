import { Metadata } from "next";
import { CollectionSlug, Payload } from "payload";

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

  const post = result.docs?.[0];

  if (!post) {
    return {
      title: "Not Found",
      description: "The page you are looking for does not exist.",
    };
  }

  // Type-safe access to post properties
  const title = (post as any).meta?.title || (post as any).title;
  const description = (post as any).meta?.description;
  const image = (post as any).meta?.image;

  const metadataBase = process.env.NEXT_PUBLIC_SERVER_URL
    ? new URL(process.env.NEXT_PUBLIC_SERVER_URL)
    : undefined;

  const ogImage =
    image && typeof image === "object" && image.url
      ? {
          url: image.url,
          width: image.width || 1200,
          height: image.height || 630,
          alt: image.alt || title,
        }
      : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description: description || "",
      type: "article",
      ...(ogImage && { images: [ogImage] }),
      ...(metadataBase && { url: new URL(`/blog/${slug}`, metadataBase).toString() }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: description || "",
      ...(ogImage && { images: [ogImage.url] }),
    },
    ...(metadataBase && { metadataBase }),
  };
}
