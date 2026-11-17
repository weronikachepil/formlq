import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Тестування",
  // Shared by link only; keep out of search results.
  robots: { index: false, follow: false },
};

export default function AssignmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
