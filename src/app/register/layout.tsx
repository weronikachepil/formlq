import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Реєстрація",
  description:
    "Зареєструйтесь на formlq безкоштовно: учням — тести НМТ і від викладачів з розбором, вчителям — математична дошка для уроків, домашні й календар.",
  alternates: {
    canonical: "/register",
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The page reads ?next= via useSearchParams, which needs a Suspense boundary.
  return <Suspense>{children}</Suspense>;
}
