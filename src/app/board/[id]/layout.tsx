import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Дошка — formlq",
  // Shared by link only; keep out of search results.
  robots: { index: false, follow: false },
};

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
