import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { docs: pages } = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/pages?limit=0`
  ).then((res) => res.json());

  const sitemap: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    sitemap.push({
      changeFrequency: "weekly",
      lastModified: page.updatedAt,
      priority: 1,
      url: `${process.env.NEXT_PUBLIC_SERVER_URL}/${page.slug === "home" ? "" : page.slug}`,
    });
  }

  return sitemap;
}
