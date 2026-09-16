import type { Metadata, Viewport } from "next";
import { Teko, Hind } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexProvider";
import { LangProvider } from "@/lib/i18n";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/site";

// Teko carries every number on the scoreboard; Hind carries everything you read.
// Both ship Devanagari, so a Hindi toggle later costs nothing.
const teko = Teko({
  variable: "--font-teko",
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const hind = Hind({
  variable: "--font-hind",
  subsets: ["latin", "devanagari"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

/* Said once, here, so the tab title, the search result and the WhatsApp preview
   all describe the same game in the same words. The picture itself comes from
   opengraph-image.png and twitter-image.png beside this file. */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · BuildXI",
  },
  description: SITE_DESCRIPTION,
  applicationName: "BuildXI",
  category: "games",
  keywords: [
    "IPL draft game",
    "all-time IPL XI",
    "IPL fantasy game",
    "IPL team builder",
    "cricket draft game",
    "IPL 2008 to 2025 squads",
    "14-0 IPL season",
    "daily IPL challenge",
  ],
  // Every share link and challenge link is this page with a query string on
  // it, and they should all count as the one page.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "BuildXI",
    locale: "en_IN",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#071238",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${teko.variable} ${hind.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-ground text-white font-body">
        <LangProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </LangProvider>
      </body>
    </html>
  );
}
