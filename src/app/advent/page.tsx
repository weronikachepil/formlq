import type { Metadata } from "next";
import Link from "next/link";
import "@/components/landing/landing.css";
import "@/components/advent/advent.css";
import { landingFontVariables } from "@/components/landing/fonts";
import { AdventCalendar } from "@/components/advent/AdventCalendar";
import { AdventNavActions } from "@/components/advent/AdventPromo";

export const metadata: Metadata = {
  title: { absolute: "Відлік до НМТ — адвент-календар з математики | formlq" },
  description:
    "24 задачі з математики в стилі НМТ, по одній на кожен день з 1 до 24 грудня. Розв'язуй, грай у різдвяні міні-ігри й отримай у подарунок 5 імітацій НМТ.",
  alternates: { canonical: "/advent" },
  openGraph: {
    title: "Відлік до НМТ — адвент-календар з математики",
    description: "24 задачі в стилі НМТ з 1 до 24 грудня. Кожна відповідь відкриває літеру фрази, а повна фраза — 5 імітацій НМТ у подарунок.",
    url: "https://www.formlq.com/advent",
  },
};

export default function AdventPage() {
  return (
    <div className={`landing ${landingFontVariables}`}>
      <div className="nav-wrap">
        <nav className="wrap nav">
          <Link className="logo" href="/">formlq</Link>
          <AdventNavActions />
        </nav>
      </div>
      <main><AdventCalendar /></main>
      <footer>
        <div className="wrap">
          <Link className="logo" href="/">formlq</Link>
          <div className="links">
            <Link href="/">Головна</Link>
            <Link href="/register">Тести НМТ безкоштовно</Link>
          </div>
          <span>© 2026 formlq</span>
        </div>
      </footer>
    </div>
  );
}
