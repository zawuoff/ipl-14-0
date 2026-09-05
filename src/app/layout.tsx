import type { Metadata, Viewport } from "next";
import { Teko, Hind } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexProvider";

// Teko carries every number on the scoreboard; Hind carries everything you read.
// Both ship Devanagari, so a Hindi toggle later costs nothing.
const teko = Teko({
  variable: "--font-teko",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const hind = Hind({
  variable: "--font-hind",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "14-0 · Draft an all-time IPL XI",
  description:
    "Spin real IPL squads from 2008 to 2025, take one player from each, and play a full season. Nobody has gone 14-0 yet.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${teko.variable} ${hind.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-ground text-ink font-body">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
