import type { Metadata } from "next";
import { JetBrains_Mono, Onest, Pinyon_Script } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { THEME_INIT_SCRIPT } from "@/lib/theme-mode";
import { ExamGuardProvider } from "@/context/ExamGuardContext";
import { HeaderProvider } from "@/context/HeaderContext";
import { QueryProvider } from "@/components/QueryProvider";
import { Toaster } from "@/components/ui/toaster";
import { SiteIntro } from "@/components/SiteIntro";
import { VisualViewportVars } from "@/components/VisualViewportVars";

/** One round geometric family for text and headings (same as the landing). */
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

/** Numbers, timers, code. */
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
});

/** Handwritten "formlq" logo. */
const pinyonScript = Pinyon_Script({
  variable: "--font-pinyon-script",
  subsets: ["latin"],
  weight: "400",
});


export const metadata: Metadata = {
  title: {
    default: "formlq — підготовка до НМТ і дошка для уроків математики",
    template: "%s | formlq",
  },
  description:
    "Безкоштовна платформа з математики: тести НМТ минулих років і тести від викладачів з автоперевіркою та розбором, а ще інтерактивна дошка для уроків, де вчитель і учні працюють разом.",
  keywords: [
    "НМТ математика",
    "підготовка до НМТ",
    "тести НМТ математика",
    "НМТ минулих років",
    "пробне НМТ",
    "онлайн тести з математики",
    "тести для учнів 5–11 класів",
    "математична дошка онлайн",
    "інтерактивна дошка для уроків",
    "дошка для репетитора",
    "онлайн уроки математики",
    "платформа для репетиторів",
    "formlq",
  ],
  authors: [{ name: "formlq" }],
  creator: "formlq",
  metadataBase: new URL("https://www.formlq.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "uk_UA",
    url: "https://www.formlq.com",
    siteName: "formlq",
    title: "formlq — підготовка до НМТ і дошка для уроків математики",
    description: "Тести НМТ минулих років і тести від викладачів з автоперевіркою, а ще інтерактивна математична дошка для уроків з учнями.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "formlq — тести НМТ і дошка для уроків математики",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "formlq — підготовка до НМТ і дошка для уроків математики",
    description: "Тести НМТ минулих років і тести від викладачів з автоперевіркою, а ще інтерактивна математична дошка для уроків з учнями.",
    images: ["/og-image.png"],
  },
  verification: {
    google: "ahC7fZQ4gnq-HvyKoPf5o7Isk317_IwrQ8KrtnXwbx4",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "formlq",
  url: "https://www.formlq.com",
  description: "Безкоштовна платформа з математики: тести НМТ минулих років і тести від викладачів з автоперевіркою та розбором, а ще інтерактивна дошка для уроків, де вчитель і учні працюють разом.",
  inLanguage: "uk",
  knowsAbout: [
    "НМТ з математики",
    "тести НМТ минулих років з автоперевіркою",
    "тести від викладачів для 5–11 класів з алгебри й геометрії",
    "інтерактивна математична дошка: графіки, об'ємні фігури, формули, побудови",
    "уроки вчителя з учнями в реальному часі, домашні завдання й календар",
  ],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "UAH",
    description: "Безкоштовна платформа для учнів і вчителів математики",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      className={`${onest.variable} ${jetbrainsMono.variable} ${pinyonScript.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved light/dark mode before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <VisualViewportVars />
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              <ExamGuardProvider>
                {/* First, so its pre-paint script runs before the page underneath is drawn. */}
                <SiteIntro />
                <HeaderProvider>{children}</HeaderProvider>
                <Toaster />
              </ExamGuardProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
