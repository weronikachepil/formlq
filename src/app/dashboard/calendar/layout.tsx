import { StaffRedirect } from "@/components/StaffRedirect";

export default function StudentCalendarLayout({ children }: { children: React.ReactNode }) {
  return <StaffRedirect to="/tutor/calendar">{children}</StaffRedirect>;
}
