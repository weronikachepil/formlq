import type { Metadata } from "next";
import Link from "next/link";
import "@/components/landing/landing.css";
import "@/components/advent/advent.css";
import { landingFontVariables } from "@/components/landing/fonts";
import { AdventPublic } from "@/components/advent/AdventPublic";
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
          {/* The landing's menu, so visitors who came from it can go back to any section. */}
          <ul className="adv-nav-links">
            <li className="home"><Link href="/">← Головна</Link></li>
            <li><Link href="/#tests">Тести</Link></li>
            <li><Link href="/#board">Дошка</Link></li>
            <li><Link href="/#how">Як це працює</Link></li>
            <li><Link href="/#faq">Питання</Link></li>
            <li><Link href="/advent" aria-current="page" className="current">Адвент 🎄</Link></li>
          </ul>
          <AdventNavActions />
        </nav>
      </div>
      <main><AdventPublic /></main>
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
