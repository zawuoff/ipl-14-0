"use client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    // Use the project's documented deployment when preview environments have
    // no public URL configured. Query hooks always need a provider.
    const url =
      process.env.NEXT_PUBLIC_CONVEX_URL ||
      "https://exciting-owl-14.convex.cloud";
    return new ConvexReactClient(url);
  }, []);
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
