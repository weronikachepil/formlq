import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вхід",
  description:
    "Увійдіть до formlq: тести НМТ і тести від викладачів з автоперевіркою, прогрес і розбір помилок, математична дошка для уроків.",
  alternates: {
    canonical: "/login",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The page reads ?next= via useSearchParams, which needs a Suspense boundary.
  return <Suspense>{children}</Suspense>;
}
