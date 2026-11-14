"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useExamGuard } from "@/context/ExamGuardContext";
import { canTutor, isEditor } from "@/lib/roles";
import { NAV, ADMIN_NAV, isNavActive, navFor, tutorNavFor } from "@/components/AppSidebar";
import { useHasTutor } from "@/hooks/useHasTutor";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const router = useRouter();
  const { userProfile, logOut } = useAuth();
  const hasTutor = useHasTutor();
  const { requestNav, requestAction } = useExamGuard();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  // Close the menu on navigation (state adjusted during render, not in an effect).
  const [prevPath, setPrevPath] = useState(path);
  if (path !== prevPath) {
    setPrevPath(path);
    setOpen(false);
  }

  function handleNav(href: string) {
    setOpen(false);
    requestNav(href);
  }

  function handleLogout() {
    setOpen(false);
    requestAction(async () => {
      await logOut();
      router.push("/login");
    });
  }

  function renderLinks(links: typeof NAV) {
    return links.map(({ icon: Icon, href, label, also }) => (
      <button
        key={href}
        onClick={() => handleNav(href)}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-full text-sm w-full text-left transition-all",
          isNavActive(path, href, also)
            ? "bg-primary text-primary-foreground font-semibold shadow-pill-dark"
            : "text-foreground/80 hover:text-foreground hover:bg-glass-strong",
        )}
      >
        <Icon size={16} />
        {label}
      </button>
    ));
  }

  function renderSection(title: string, links: typeof NAV) {
    return (
      <>
        <div className="my-1 h-px bg-foreground/10 mx-3" />
        <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground font-semibold px-4 pb-0.5">
          {title}
        </p>
        {renderLinks(links)}
      </>
    );
  }

  return (
    <div ref={ref} className="relative md:hidden shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Закрити меню" : "Відкрити меню"}
        aria-expanded={open}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-all",
          open
            ? "bg-primary text-primary-foreground shadow-pill-dark"
            : "bg-glass text-foreground shadow-pill hover:bg-glass-strong",
        )}
      >
        {open ? <X size={19} /> : <Menu size={19} />}
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-100 min-w-52.5 bg-popover border border-glass-edge rounded-[1.75rem] shadow-glass-lg backdrop-blur-xl p-2 flex flex-col gap-0.5">
          {renderLinks(navFor(userProfile?.role, hasTutor))}
          {canTutor(userProfile?.role) && renderSection("Кабінет вчителя", tutorNavFor(userProfile?.role))}
          {isEditor(userProfile?.role) && renderSection("Адмін", ADMIN_NAV)}

          {/* Profile + logout */}
          <div className="my-1 h-px bg-foreground/10 mx-3" />
          <button
            onClick={() => handleNav("/dashboard/profile")}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-full text-sm w-full text-left transition-all",
              path === "/dashboard/profile"
                ? "bg-primary text-primary-foreground font-semibold shadow-pill-dark"
                : "text-foreground/80 hover:text-foreground hover:bg-glass-strong",
            )}
          >
            <UserRound size={16} />
            Профіль
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-full text-sm w-full text-left text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all"
          >
            <LogOut size={16} />
            Вийти
          </button>
        </div>
      )}
    </div>
  );
}
