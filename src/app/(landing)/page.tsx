import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";
import { LandingGate } from "@/components/landing/LandingGate";

export const metadata: Metadata = {
  title: { absolute: "formlq — математика від 5 класу до НМТ: тести, домашні й дошка" },
  description:
    "Тести для 5–11 класів і НМТ з автоперевіркою, домашні завдання від викладача та інтерактивна математична дошка: графіки, фігури, формули, спільна робота вчителя й учнів.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <LandingGate>
      <Landing />
    </LandingGate>
  );
}
