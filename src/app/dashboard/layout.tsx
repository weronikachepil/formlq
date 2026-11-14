"use client";

import { useEffect } from "react";
import { AppShell, SectionGreeting } from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";

function timeGreeting(hour: number) {
  if (hour < 5) return "Доброї ночі";
  if (hour < 12) return "Доброго ранку";
  if (hour < 17) return "Доброго дня";
  return "Доброго вечора";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Warm the PDF cache in idle time so the drawer opens instantly. Only once signed in:
  // a signed-out visitor is about to be sent to the login page.
  const signedIn = !!user;
  useEffect(() => {
    if (!signedIn) return;
    const cb = () => {
      import("@/lib/pdf-cache").then((m) => m.preloadPdf());
    };
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(cb);
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(cb, 1000);
    return () => clearTimeout(id);
  }, [signedIn]);

  return (
    <AppShell
      allow={({ user }) => !!user}
      redirectTo="/login"
      redirectMode="push"
      homePath="/dashboard"
      fallbackName="Учень"
      greeting={(name) => <SectionGreeting label={timeGreeting(new Date().getHours())} name={name} />}
    >
      {children}
    </AppShell>
  );
}
