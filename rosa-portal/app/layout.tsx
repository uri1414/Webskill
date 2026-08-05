import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Rosa & Co. CPA — Client Portal",
    template: "%s · Rosa & Co. CPA",
  },
  description: "Request an appointment and track its status with Rosa & Co. CPA.",
  applicationName: "Rosa & Co. CPA Portal",
  // The portal is private — keep it out of search engines.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
