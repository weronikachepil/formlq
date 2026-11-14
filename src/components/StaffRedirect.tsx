"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { canTutor } from "@/lib/roles";

/**
 * Student-only section: tutors/editors are never anyone's student, so they are
 * sent to the matching place in their own cabinet instead.
 */
export function StaffRedirect({ to, children }: { to: string; children: React.ReactNode }) {
  const { userProfile, loading } = useAuth();
  const router = useRouter();
  const staff = canTutor(userProfile?.role);

  useEffect(() => {
    if (!loading && staff) router.replace(to);
  }, [loading, staff, router, to]);

  if (loading || staff) return null;
  return children;
}
