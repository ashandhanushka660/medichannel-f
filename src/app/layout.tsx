import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediChannel · Lanka Care Hospital",
  description:
    "Find doctors, book and manage appointments, follow your live queue, and consult online at Lanka Care Hospital.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/mediclinic-system.html" },
  openGraph: {
    type: "website",
    siteName: "MediChannel",
    title: "MediChannel · Lanka Care Hospital",
    description:
      "Find doctors, book appointments, follow your live queue and consult online.",
    url: "/mediclinic-system.html",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
