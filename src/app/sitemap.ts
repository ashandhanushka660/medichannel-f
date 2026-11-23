import type { MetadataRoute } from "next";

const SITE_URL = "https://app.medichannel.dpdns.org";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/mediclinic-system.html`,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
