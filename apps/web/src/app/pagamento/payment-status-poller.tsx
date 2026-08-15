"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Polls the server for the webhook-driven payment confirmation without the buyer needing to
 * manually refresh — unmounts naturally once the page re-renders into a non-pending state. */
export function PaymentStatusPoller({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
