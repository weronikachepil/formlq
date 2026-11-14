import { PageTransition } from "@/components/ui/page-transition";

/** Smooth page change inside the section: the shell stays, the content fades in. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
