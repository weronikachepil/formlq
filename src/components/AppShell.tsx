"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";
import { useHeader } from "@/context/HeaderContext";
import { useExamGuard } from "@/context/ExamGuardContext";
import { ReferenceDrawerProvider } from "@/context/ReferenceDrawerContext";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { ThemeSelector } from "@/components/ThemeSelector";
import { BugReportDialog } from "@/components/bugs/BugReportDialog";
import { useHomeworkBackfill } from "@/hooks/useHomeworkBackfill";
import { SpinnerScreen } from "@/components/ui/spinner";
import { cn, withNext } from "@/lib/utils";
import type { UserProfile } from "@/types";

const ReferenceDrawer = dynamic(
  () => import("@/components/ReferenceDrawer").then((m) => ({ default: m.ReferenceDrawer })),
  { ssr: false },
);

interface AppShellProps {
  children: React.ReactNode;
  /** Access check, evaluated once auth has finished loading. */
  allow: (auth: { user: User | null; userProfile: UserProfile | null }) => boolean;
  /** Where to send users who fail `allow`. */
  redirectTo: string;
  /** `replace` (default) or `push` the redirect onto history. */
  redirectMode?: "replace" | "push";
  /** Section root path; the greeting is shown there instead of the page title. */
  homePath: string;
  /** Name shown when the profile has no display name. */
  fallbackName: string;
  /** Also show the greeting on sub-pages that did not set a header title. */
  greetWhenUntitled?: boolean;
  /** Renders the greeting block for the header. */
  greeting: (firstName: string) => React.ReactNode;
}

/** Shared authenticated chrome: role guard, sticky header, sidebar, mobile nav, reference drawer. */
export function AppShell({
  children,
  allow,
  redirectTo,
  redirectMode = "replace",
  homePath,
  fallbackName,
  greetWhenUntitled = false,
  greeting,
}: AppShellProps) {
  const { user, userProfile, loading, logOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { title, subtitle } = useHeader();
  const { requestAction } = useExamGuard();
  const [scrolled, setScrolled] = useState(false);
  const [reporting, setReporting] = useState(false);
  // Teachers/editors: one-time copy of test questions into old homework.
  useHomeworkBackfill();

  const allowed = allow({ user, userProfile });

  useEffect(() => {
    if (loading || allowed) return;
    // Signed-out visitors come back to this page after logging in (e.g. from a test QR code).
    const target = !user && redirectTo === "/login" ? withNext("/login", pathname) : redirectTo;
    if (redirectMode === "push") router.push(target);
    else router.replace(target);
  }, [allowed, loading, router, redirectTo, redirectMode, user, pathname]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  function handleLogout() {
    requestAction(async () => {
      await logOut(); // reloads on /login
    });
  }

  if (loading) return <SpinnerScreen />;
  if (!allowed) return null;

  const rawFirst = (userProfile?.displayName ?? user?.displayName ?? fallbackName).split(" ")[0];
  // Names are stored as typed ("veronika"); the greeting shows them capitalised.
  const firstName = rawFirst.charAt(0).toLocaleUpperCase("uk") + rawFirst.slice(1);
  const showGreeting = pathname === homePath || (greetWhenUntitled && !title);

  return (
    <ReferenceDrawerProvider>
      <div
        // No background here: the page colour lives on <body>.
        // Header height / sidebar width, so sticky & fixed bars (exam) can offset by them.
        className="min-h-screen flex flex-col md:pl-[var(--app-sidebar-w)] [--app-header-h:4rem] md:[--app-sidebar-w:4.5rem] lg:[--app-sidebar-w:16.5rem] lg:[--app-header-h:6rem]"
      >
        <header
          className={cn(
            "sticky top-0 z-50 w-full px-4 md:px-6 lg:px-10 h-[var(--app-header-h)] flex items-center gap-3 justify-between transition-all duration-200",
            // Large screens: no bar at all, just the page title on the grey page (scrolls under nothing).
            scrolled
              ? "bg-background/85 backdrop-blur-xl border-b border-glass-edge lg:border-transparent"
              : "border-b border-transparent",
          )}
        >
          <MobileNav onReportBug={() => setReporting(true)} />
          {/* Logo here only on tablets; on large screens it sits at the top of the sidebar. */}
          {/* Wrapper carries the visibility: `.mb-logo` sets its own display. */}
          <span className="hidden md:inline-flex lg:hidden shrink-0 mr-3 -mt-1">
            <span className="mb-logo text-[1.85rem] select-none">formlq</span>
          </span>
          {showGreeting ? (
            greeting(firstName)
          ) : (
            <div className="flex items-baseline gap-3 flex-1 min-w-0">
              <span className="font-heading font-bold text-lg md:text-xl lg:text-[32px] lg:tracking-[-0.02em] leading-tight truncate">
                {title}
              </span>
              {subtitle && (
                <span className="text-sm lg:text-[15px] text-muted-foreground leading-tight truncate hidden sm:block">
                  {subtitle}
                </span>
              )}
            </div>
          )}

          {/* On large screens the theme switch sits next to the logo in the sidebar. */}
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeSelector className="w-10 h-10" />
          </div>
        </header>

        <div className="flex flex-1">
          <AppSidebar onReportBug={() => setReporting(true)} onLogout={handleLogout} />
          <ReferenceDrawer />
          <main className="flex-1 min-w-0 p-4 md:p-6 lg:px-10 lg:pt-4 lg:pb-10">{children}</main>
        </div>
        {reporting && <BugReportDialog onClose={() => setReporting(false)} />}
      </div>
    </ReferenceDrawerProvider>
  );
}

/**
 * Greeting. Small screens: a muted label above the name; large screens: one big
 * page title, «Доброго вечора, Veronika».
 */
export function SectionGreeting({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex flex-col justify-center gap-0.5 flex-1 min-w-0">
      <span className="text-[13px] font-medium text-muted-foreground leading-tight truncate lg:hidden">{label}</span>
      <span className="font-heading text-xl md:text-2xl lg:text-[32px] lg:tracking-[-0.02em] font-bold leading-tight truncate">
        <span className="hidden lg:inline">{label}, </span>
        {name}
      </span>
    </div>
  );
}
