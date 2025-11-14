// app/ga/AnalyticsListener.tsx
"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function AnalyticsListener() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;

    // aguarda GA ter carregado
    if (typeof window === "undefined" || !(window as any).gtag) return;

    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : "");

    (window as any).gtag("config", process.env.NEXT_PUBLIC_GA_ID || "G-NWHS5JN1ZN", {
      page_path: url,
    });
  }, [pathname, searchParams]);

  return null;
}
