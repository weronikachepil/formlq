import { redirect } from "next/navigation";

// Homework now lives in the students' cabinets; keep old links working.
export default function TutorHomeworkRedirect() {
  redirect("/tutor/students");
}
