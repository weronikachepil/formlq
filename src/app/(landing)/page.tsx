import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";
import { LandingGate } from "@/components/landing/LandingGate";

export const metadata: Metadata = {
  title: { absolute: "formlq — підготовка до НМТ і дошка для уроків математики" },
  description:
    "Тести НМТ минулих років і тести від викладачів з автоперевіркою та інтерактивна математична дошка: графіки, фігури, формули, спільна робота вчителя й учнів.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <LandingGate>
      <Landing />
    </LandingGate>
  );
}
