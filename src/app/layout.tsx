import type { Metadata } from "next";
import { Comfortaa, JetBrains_Mono, Manrope, Marck_Script, Montserrat, Pinyon_Script } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { THEME_INIT_SCRIPT } from "@/lib/theme-mode";
import { ExamGuardProvider } from "@/context/ExamGuardContext";
import { HeaderProvider } from "@/context/HeaderContext";
import { QueryProvider } from "@/components/QueryProvider";
import { Toaster } from "@/components/ui/toaster";

/** Body text (MathBoard design). */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

/** Headings: heavy, wide. */
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800", "900"],
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

// Board-only fonts below: declared app-wide because the board engine reads their
// variables from <html>, but not preloaded, so the browser downloads them only on
// pages that actually use them (the board), not on every page.

/** Whiteboard canvas UI font (read by the board engine through --font-comfortaa). */
const comfortaa = Comfortaa({
  variable: "--font-comfortaa",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
  preload: false,
});

/** Whiteboard handwriting font; the board engine reads --font-marck-script from <html>. */
const marckScript = Marck_Script({
  variable: "--font-marck-script",
  subsets: ["latin", "cyrillic"],
  weight: "400",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "formlq — підготовка до НМТ з математики",
    template: "%s | formlq",
  },
  description:
    "Безкоштовна онлайн-платформа для підготовки до НМТ з математики. Пробні тести, тренувальні завдання, детальний аналіз результатів. НМТ 2025 математика.",
  keywords: [
    "НМТ математика",
    "підготовка до НМТ",
    "НМТ 2025",
    "пробне НМТ",
    "тести НМТ математика",
    "НМТ завдання",
    "онлайн тести НМТ",
    "тренування НМТ",
    "математика НМТ онлайн",
    "formlq",
    "підготовка до іспиту математика",
    "НМТ підготовка безкоштовно",
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
    title: "formlq — підготовка до НМТ з математики",
    description:
      "Безкоштовна онлайн-платформа для підготовки до НМТ з математики. Пробні тести, тренувальні завдання, аналіз результатів.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "formlq — підготовка до НМТ з математики",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "formlq — підготовка до НМТ з математики",
    description:
      "Безкоштовна онлайн-платформа для підготовки до НМТ з математики. Пробні тести, аналіз результатів.",
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
  description:
    "Онлайн-платформа для підготовки до НМТ з математики. Пробні тести, тренувальні завдання, аналіз результатів.",
  inLanguage: "uk",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "UAH",
    description: "Безкоштовна підготовка до НМТ з математики",
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
      className={`${manrope.variable} ${montserrat.variable} ${jetbrainsMono.variable} ${pinyonScript.variable} ${comfortaa.variable} ${marckScript.variable} h-full antialiased`}
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
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              <ExamGuardProvider>
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
