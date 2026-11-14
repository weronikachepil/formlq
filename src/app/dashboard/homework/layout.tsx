import { StaffRedirect } from "@/components/StaffRedirect";

export default function StudentHomeworkLayout({ children }: { children: React.ReactNode }) {
  return <StaffRedirect to="/tutor/students">{children}</StaffRedirect>;
}
