"use client";

import { AppShell, SectionGreeting } from "@/components/AppShell";
import { isEditor } from "@/lib/roles";
import { TelegramPromo } from "@/components/tutor/TelegramPromo";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      allow={({ userProfile }) => isEditor(userProfile?.role)}
      redirectTo="/dashboard"
      homePath="/admin"
      fallbackName="Адмін"
      greeting={(name) => <SectionGreeting label="Адмін-панель" name={name} />}
    >
      {children}
      <TelegramPromo />
    </AppShell>
  );
}
