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

  return {
    title: page.meta?.title || page.title,
    description: page.meta?.description,
    openGraph: {
      title: page.meta?.title || page.title,
      description: page.meta?.description || "",
      images:
        page.meta?.image && typeof page.meta.image === "object"
          ? [{ url: page.meta.image.url || "" }]
          : [],
    },
    metadataBase: process.env.NEXT_PUBLIC_SERVER_URL
      ? new URL(process.env.NEXT_PUBLIC_SERVER_URL)
      : undefined,
  };
}
