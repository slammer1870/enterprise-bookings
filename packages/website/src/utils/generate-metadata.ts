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

  return {
    title,
    description,
    openGraph: {
      title,
      description: description || "",
      images:
        (page as any).meta?.image && typeof (page as any).meta.image === "object"
          ? [{ url: (page as any).meta.image.url || "" }]
          : [],
    },
    metadataBase: process.env.NEXT_PUBLIC_SERVER_URL
      ? new URL(process.env.NEXT_PUBLIC_SERVER_URL)
      : undefined,
  };
}
