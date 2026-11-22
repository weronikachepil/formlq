"use client";

import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  History,
  ShieldCheck,
  Lightbulb,
  Users,
  ClipboardCheck,
  CalendarDays,
  Presentation,
  Bug,
  Timer,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useExamGuard } from "@/context/ExamGuardContext";
import { useHasTutor } from "@/hooks/useHasTutor";
import { ThemeSelector } from "@/components/ThemeSelector";
import { canTutor, isEditor, ROLE_META } from "@/lib/roles";
import type { UserRole } from "@/types";

type NavLink = {
  icon: LucideIcon;
  href: string;
  label: string;
  /** Other path prefixes that belong to this section. */
  also?: string[];
  /** Hidden for tutors/editors (they are never anyone's student). */
  studentOnly?: boolean;
  /** The platform's test catalog: hidden from teachers (they have only their own tests). */
  catalog?: boolean;
  /** Teachers only: editors manage the same thing in the admin area. */
  teacherOnly?: boolean;
  /** Only for students who have a teacher (homework, lessons). */
  withTutor?: boolean;
};

export const NAV: NavLink[] = [
  { icon: Home, href: "/dashboard", label: "Головна" },
  { icon: FileText, href: "/dashboard/tests", label: "Тести", catalog: true },
  { icon: ClipboardCheck, href: "/dashboard/homework", label: "Домашні", studentOnly: true, withTutor: true },
  { icon: CalendarDays, href: "/dashboard/calendar", label: "Календар", studentOnly: true, withTutor: true },
  { icon: Presentation, href: "/dashboard/boards", label: "Дошки", studentOnly: true },
  { icon: History, href: "/dashboard/history", label: "Історія" },
];

export const TUTOR_NAV: NavLink[] = [
  // Students and their homework are one section: cabinets per student.
  { icon: Users, href: "/tutor/students", label: "Учні", also: ["/tutor/homework", "/tutor/groups"] },
  { icon: FileText, href: "/tutor/tests", label: "Мої тести", teacherOnly: true },
  { icon: Timer, href: "/tutor/assignments", label: "Тестування" },
  { icon: CalendarDays, href: "/tutor/calendar", label: "Календар" },
  { icon: Presentation, href: "/tutor/boards", label: "Дошки" },
];

export const ADMIN_NAV: NavLink[] = [
  { icon: ShieldCheck, href: "/admin/tests", label: "Редактор тестів" },
  { icon: Lightbulb, href: "/admin/tips", label: "Поради" },
  { icon: Users, href: "/admin/users", label: "Користувачі" },
  { icon: ClipboardCheck, href: "/admin/questions", label: "Завдання" },
  { icon: Bug, href: "/admin/bugs", label: "Помилки" },
];

/** The common section for this role: staff don't see student-only items. */
export function navFor(role: UserRole | null | undefined, hasTutor?: boolean): NavLink[] {
  // While unknown (`undefined`) keep everything, so real students don't see items pop in.
  if (!canTutor(role)) return NAV.filter((l) => !(l.withTutor && hasTutor === false));
  return NAV.filter((l) => !l.studentOnly && !(l.catalog && !isEditor(role)));
}

/** The teacher's section for this role (editors skip what the admin area covers). */
export function tutorNavFor(role: UserRole | null | undefined): NavLink[] {
  return isEditor(role) ? TUTOR_NAV.filter((l) => !l.teacherOnly) : TUTOR_NAV;
}

/** Dashboard home matches exactly; every other link matches its subtree (and its `also` prefixes). */
export function isNavActive(path: string, href: string, also: string[] = []) {
  if (href === "/dashboard") return path === href;
  return [href, ...also].some((p) => path.startsWith(p));
}

/**
 * Desktop navigation. On large screens a full-height panel with labelled links in
 * groups, the user's card on top and help / sign-out at the bottom; on tablets
 * the same links collapse to an icon rail with tooltips. Width comes from
 * `--app-sidebar-w`, set by the app shell.
 */
export function AppSidebar({ onReportBug, onLogout }: { onReportBug: () => void; onLogout: () => void }) {
  const path = usePathname();
  const { user, userProfile } = useAuth();
  const { requestNav } = useExamGuard();
  const hasTutor = useHasTutor();
  const role = userProfile?.role;

  function renderLinks(links: NavLink[]) {
    return links.map(({ icon, href, label, also }) => (
      <NavItem
        key={href}
        label={label}
        Icon={icon}
        active={isNavActive(path, href, also)}
        onClick={() => requestNav(href)}
      />
    ));
  }

  // Shown capitalised word by word ("veronika chepil" → "Veronika Chepil").
  const name = (userProfile?.displayName ?? user?.displayName ?? "").replace(
    /(^|\s)(\S)/g,
    (_m, sp: string, ch: string) => sp + ch.toLocaleUpperCase("uk"),
  );
  const photo = userProfile?.photoURL ?? user?.photoURL ?? undefined;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden md:flex w-[var(--app-sidebar-w)] flex-col border-r border-sidebar-border bg-sidebar">
      {/* Same height as the page title, so logo and title share one line. */}
      <div className="hidden h-[var(--app-header-h)] items-center justify-between pl-6 pr-4 lg:flex">
        <span className="mb-logo text-[2rem] select-none">formlq</span>
        <ThemeSelector className="size-10" />
      </div>

      <div className="px-3 pt-4 lg:px-4 lg:pt-0">
        <button
          type="button"
          onClick={() => requestNav("/dashboard/profile")}
          aria-label="Профіль"
          className={cn(
            "group flex w-full items-center justify-center gap-3 rounded-[16px] p-1.5 text-left transition-colors lg:justify-start lg:bg-card lg:p-3",
            "hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          )}
        >
          <Avatar name={name} photo={photo} />
          <span className="hidden min-w-0 flex-1 lg:block">
            <span className="block truncate text-[15px] font-semibold">{name || "Профіль"}</span>
            {role && <span className="block truncate text-[13px] text-muted-foreground">{ROLE_META[role].label}</span>}
          </span>
          <ChevronRight size={16} className="hidden shrink-0 text-muted-foreground lg:block" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto px-3 py-4 lg:items-stretch lg:px-4" aria-label="Розділи">
        {renderLinks(navFor(role, hasTutor))}

        {canTutor(role) && (
          <>
            <GroupTitle>Викладання</GroupTitle>
            {renderLinks(tutorNavFor(role))}
          </>
        )}

        {isEditor(role) && (
          <>
            <GroupTitle>Адміністрування</GroupTitle>
            {renderLinks(ADMIN_NAV)}
          </>
        )}
      </nav>

      <div className="flex flex-col items-center gap-1 border-t border-sidebar-border px-3 py-3 lg:items-stretch lg:px-4">
        <NavItem label="Знайшли помилку?" Icon={Bug} active={false} onClick={onReportBug} />
        <NavItem label="Вийти" Icon={LogOut} active={false} onClick={onLogout} />
      </div>
    </aside>
  );
}

/** Group heading on large screens, a short divider on the icon rail. */
function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="my-1.5 h-px w-6 bg-foreground/10 lg:hidden" />
      <p className="hidden px-3 pt-4 pb-1 text-[13px] font-semibold text-muted-foreground lg:block">{children}</p>
    </>
  );
}

/** The user's photo, or their initial on a lavender disc. */
function Avatar({ name, photo }: { name: string; photo?: string }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className="size-10 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />;
  }
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lavender text-sm font-bold text-[#14262a]">
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

function NavItem({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-11 w-11 items-center justify-center gap-3 rounded-full text-sm font-semibold transition-colors",
          "lg:h-11 lg:w-full lg:justify-start lg:gap-3.5 lg:rounded-[14px] lg:px-3.5 lg:text-[15px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        <Icon size={20} className="shrink-0" />
        <span className="hidden truncate lg:inline">{label}</span>
      </button>
      <Tooltip label={label} />
    </div>
  );
}

/** Label for the icon rail (tablets); the full panel shows labels inline. */
function Tooltip({ label }: { label: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50 lg:hidden",
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
        "bg-primary text-primary-foreground shadow-pill-dark",
        "text-xs font-semibold whitespace-nowrap",
        "opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0",
        "transition-all duration-150",
      )}
    >
      {label}
    </div>
  );
}
