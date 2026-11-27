"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AdventCalendar } from "./AdventCalendar";
import { AdventGuestSteps } from "./AdventAccess";

/**
 * Public /advent: a teaser for guests (how to get a code). Signed-in visitors are sent to
 * the cabinet, where the calendar opens with their personal code.
 */
export function AdventPublic() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard/advent");
  }, [loading, user, router]);
  return <AdventCalendar locked={<AdventGuestSteps />} />;
}
