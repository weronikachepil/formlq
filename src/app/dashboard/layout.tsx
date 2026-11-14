"use client";

import { useEffect } from "react";
import { AppShell, SectionGreeting } from "@/components/AppShell";

function timeGreeting(hour: number) {
  if (hour < 5) return "Доброї ночі";
  if (hour < 12) return "Доброго ранку";
  if (hour < 17) return "Доброго дня";
  return "Доброго вечора";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Warm PDF cache in idle time so drawer opens instantly
  useEffect(() => {
    const cb = () => {
      import("@/lib/pdf-cache").then((m) => m.preloadPdf());
    };
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(cb);
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(cb, 1000);
    return () => clearTimeout(id);
  }, []);

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
