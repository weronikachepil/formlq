"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "firebase/auth";
import { Bug, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useHeader } from "@/context/HeaderContext";
import { useExamGuard } from "@/context/ExamGuardContext";
import { ReferenceDrawerProvider } from "@/context/ReferenceDrawerContext";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { ThemeSelector } from "@/components/ThemeSelector";
import { BugReportDialog } from "@/components/bugs/BugReportDialog";
import { useHomeworkBackfill } from "@/hooks/useHomeworkBackfill";
import { IconButton } from "@/components/ui/icon-button";
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
  const { requestAction, requestNav } = useExamGuard();
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

  const firstName = (userProfile?.displayName ?? user?.displayName ?? fallbackName).split(" ")[0];
  const showGreeting = pathname === homePath || (greetWhenUntitled && !title);

  return (
    <ReferenceDrawerProvider>
      <div
        // No background here: the MathBoard gradient lives on <body>; `mb-dots` adds the dotted circles.
        className="mb-dots min-h-screen flex flex-col md:[--app-sidebar-w:4.5rem]"
        // Header height / sidebar width, so sticky & fixed bars (exam) can offset by them.
        style={{ "--app-header-h": "4rem" } as React.CSSProperties}
      >
        <header
          className={cn(
            "sticky top-0 z-50 w-full pl-4 md:pl-6 pr-4 md:pr-6 h-16 flex items-center gap-3 justify-between transition-all duration-200",
            scrolled
              ? "bg-background/70 backdrop-blur-xl border-b border-glass-edge shadow-glass"
              : "border-b border-transparent",
          )}
        >
          <MobileNav onReportBug={() => setReporting(true)} />
          {/* Handwritten MathBoard-style logo with the gold spark. */}
          <span className="mb-logo text-[1.85rem] hidden md:inline-block shrink-0 mr-3 -mt-1 select-none">
            formlq
          </span>
          {showGreeting ? (
            greeting(firstName)
          ) : (
            <div className="flex items-baseline gap-3 flex-1 min-w-0">
              <span className="font-heading font-extrabold uppercase tracking-[0.02em] text-lg md:text-xl leading-tight truncate">
                {title}
              </span>
              {subtitle && (
                <span className="text-sm text-muted-foreground leading-tight truncate hidden sm:block">
                  {subtitle}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <ThemeSelector className="w-10 h-10" />
            <div className="hidden md:contents">
              <div className="relative group">
                <IconButton
                  label="Повідомити про помилку"
                  title=""
                  size="md"
                  onClick={() => setReporting(true)}
                  className="w-10 h-10 bg-glass text-foreground shadow-pill hover:bg-glass-strong"
                >
                  <Bug size={16} />
                </IconButton>
                <div className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-50 flex items-center px-3 py-1.5 rounded-full bg-primary text-primary-foreground shadow-pill-dark text-xs font-semibold whitespace-nowrap opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
                  Повідомити про помилку
                </div>
              </div>
              <div className="relative group">
                <IconButton
                  label="Профіль"
                  title=""
                  size="md"
                  onClick={() => requestNav("/dashboard/profile")}
                  className="w-10 h-10 bg-glass text-foreground shadow-pill hover:bg-glass-strong"
                >
                  <UserRound size={16} />
                </IconButton>
                <div className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-50 flex items-center px-3 py-1.5 rounded-full bg-primary text-primary-foreground shadow-pill-dark text-xs font-semibold whitespace-nowrap opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
                  Профіль
                </div>
              </div>
              <div className="relative group">
                {/* Empty title: the styled tooltip below replaces the native one. */}
                <IconButton
                  label="Вийти"
                  title=""
                  size="md"
                  onClick={handleLogout}
                  className="w-10 h-10 bg-glass text-foreground shadow-pill hover:bg-glass-strong"
                >
                  <LogOut size={16} />
                </IconButton>
                <div className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-50 flex items-center px-3 py-1.5 rounded-full bg-primary text-primary-foreground shadow-pill-dark text-xs font-semibold whitespace-nowrap opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
                  Вийти
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1">
          <AppSidebar />
          <ReferenceDrawer />
          <main className="ml-0 md:ml-18 flex-1 p-4 md:p-6">{children}</main>
        </div>
        {reporting && <BugReportDialog onClose={() => setReporting(false)} />}
      </div>
    </ReferenceDrawerProvider>
  );
}

/** Two-line MathBoard greeting: tracked uppercase label above the first name in the heavy head font. */
export function SectionGreeting({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex flex-col justify-center gap-0.5 flex-1 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground leading-tight truncate">
        {label}
      </span>
      <span className="font-heading text-xl md:text-2xl font-extrabold uppercase leading-none truncate">{name}</span>
    </div>
  );
}
