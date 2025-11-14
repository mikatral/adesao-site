"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-NWHS5JN1ZN";

export default function AnalyticsListener() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    if (typeof window === "undefined") return;

    const url =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");

    // Tipar o window com gtag opcional, sem usar any
    const w = window as Window & {
      gtag?: (command: string, targetId: string, params?: Record<string, unknown>) => void;
    };

    if (!w.gtag) return;

    w.gtag("config", GA_ID, {
      page_path: url,
    });
  }, [pathname, searchParams]);

  return null;
}
