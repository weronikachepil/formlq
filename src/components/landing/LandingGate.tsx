"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { SpinnerScreen } from "@/components/ui/spinner";

/**
 * Shows the landing only to signed-out visitors. While auth is resolving (and
 * while a signed-in user is being redirected) a spinner is shown instead. The
 * landing markup is still server-rendered, just hidden, so crawlers see it.
 */
export function LandingGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  // With the sign-in/sign-up modal open (/login, /register over the landing) the form
  // itself sends the user on after signing in, e.g. a new teacher to their students.
  const onLanding = usePathname() === "/";

  useEffect(() => {
    if (!loading && user && onLanding) {
      router.replace("/dashboard");
    }
  }, [user, loading, onLanding, router]);

  const showLanding = !loading && !user;

  return (
    <>
      {!showLanding && <SpinnerScreen />}
      <div hidden={!showLanding} style={{ display: showLanding ? "contents" : "none" }}>
        {children}
      </div>
    </>
  );
}
