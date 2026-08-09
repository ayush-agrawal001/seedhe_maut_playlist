import type { MetadataRoute } from "next";
import { abs } from "@/lib/seo";
import { getCatalog } from "@/lib/server/catalog";

export const revalidate = 21600; // 6h, matching the catalogue cache

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: abs("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: abs("/songs"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: abs("/albums"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: abs("/about"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  // Album pages are only listed if the catalogue is actually reachable.
  try {
    const { albums } = await getCatalog();
    return [
      ...staticRoutes,
      ...albums.map((a) => ({
        url: abs(`/albums/${a.id}`),
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
