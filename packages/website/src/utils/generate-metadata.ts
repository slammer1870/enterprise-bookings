import { Metadata } from "next";
import { CollectionSlug, Payload } from "payload";

type Args = {
  params: Promise<{
    slug?: string;
  }>;
  payload: Payload;
};

export async function generateMetadataFunction({
  params: paramsPromise,
  payload,
}: Args): Promise<Metadata> {
  const { slug = "home" } = await paramsPromise;

  const result = await payload.find({
    collection: "pages" as CollectionSlug,
    limit: 1,
    where: {
      slug: {
        equals: slug,
      },
    },
  });

  const page = result.docs?.[0];

  if (!page) {
    return {
      title: "Not Found",
      description: "The page you are looking for does not exist.",
    };
  }

  // Type-safe access to page properties
  const title = (page as any).meta?.title || (page as any).title;
  const description = (page as any).meta?.description;
  const image = (page as any).meta?.image;

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
      ...(ogImage && { images: [ogImage] }),
      ...(metadataBase && { url: new URL(slug === "home" ? "" : slug, metadataBase).toString() }),
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
