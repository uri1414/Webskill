import type { Metadata } from "next";
import { Suspense } from "react";
import { NavProgress } from "@/components/NavProgress";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://baselineplatformapp.netlify.app";

// og image / favicon come from app/opengraph-image.png, app/twitter-image.png,
// app/icon.png (Next auto-wires those). This adds the titles + descriptions so
// shared links show a proper preview card instead of a blank spinner.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Rosa & Co. CPA — Client Portal",
    template: "%s · Baseline Studio",
  },
  description:
    "Track your website project, upload files, view your live site, and message your team — all in one place.",
  applicationName: "Rosa & Co. CPA Portal",
  openGraph: {
    type: "website",
    siteName: "Baseline Studio",
    title: "Rosa & Co. CPA — Client Portal",
    description:
      "Track your website project, upload files, view your live site, and message your team — all in one place.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Rosa & Co. CPA — Client Portal",
    description: "Track your website project, upload files, and message your team.",
  },
  // The portal is private — keep it out of search engines.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
