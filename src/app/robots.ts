import type { MetadataRoute } from "next";

const SITE_URL = "https://app.medichannel.dpdns.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/mediclinic-system.html",
          "/images/",
          "/fonts/",
          "/vendor/",
        ],
        disallow: [
          "/api/",
          "/login",
          "/register",
          "/appointments",
          "/profile",
          "/consultation",
          "/doctor",
          "/manager",
          "/admin",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
