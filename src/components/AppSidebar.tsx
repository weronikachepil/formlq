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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useExamGuard } from "@/context/ExamGuardContext";
import { useHasTutor } from "@/hooks/useHasTutor";
import { canTutor, isEditor } from "@/lib/roles";
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
  { icon: ShieldCheck, href: "/admin/tests", label: "Тести" },
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

export function AppSidebar() {
  const path = usePathname();
  const { userProfile } = useAuth();
  const { requestNav } = useExamGuard();
  const hasTutor = useHasTutor();

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

  return (
    <aside className="fixed left-4 top-1/2 -translate-y-1/2 w-16 hidden md:flex flex-col items-center z-40">
      {/* Single floating white-glass pill (MathBoard) — sections split by dividers */}
      <div
        className={cn(
          "flex flex-col items-center gap-1.5 p-2 rounded-[2.5rem]",
          "bg-sidebar border border-sidebar-border shadow-glass backdrop-blur-xl",
        )}
      >
        {renderLinks(navFor(userProfile?.role, hasTutor))}

        {canTutor(userProfile?.role) && (
          <>
            <div className="h-px w-6 bg-foreground/10 my-0.5" />
            {renderLinks(tutorNavFor(userProfile?.role))}
          </>
        )}

        {isEditor(userProfile?.role) && (
          <>
            <div className="h-px w-6 bg-foreground/10 my-0.5" />
            {renderLinks(ADMIN_NAV)}
          </>
        )}
      </div>
    </aside>
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
        className={cn(
          "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-pill-dark"
            : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:shadow-pill",
        )}
      >
        <Icon size={20} className="transition-transform duration-200 group-hover:scale-110" />
      </button>
      <Tooltip label={label} />
    </div>
  );
}

function Tooltip({ label }: { label: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50",
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
