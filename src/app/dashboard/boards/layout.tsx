import { StaffRedirect } from "@/components/StaffRedirect";

export default function StudentBoardsLayout({ children }: { children: React.ReactNode }) {
  return <StaffRedirect to="/tutor/boards">{children}</StaffRedirect>;
}
