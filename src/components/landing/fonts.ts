import { JetBrains_Mono, Manrope, Montserrat, Pinyon_Script } from "next/font/google";

// Fonts used only by the landing page. Applied on the `.landing` root via
// CSS variables, referenced from ./landing.css.

const manrope = Manrope({
  variable: "--lf-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--lf-montserrat",
  subsets: ["latin", "cyrillic"],
  weight: ["700", "800", "900"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--lf-jetbrains",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
  display: "swap",
});

// Pinyon Script has no Cyrillic subset on Google Fonts; Cyrillic glyphs fall
// back to the `cursive` generic family, same as in the original HTML.
const pinyonScript = Pinyon_Script({
  variable: "--lf-pinyon",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const landingFontVariables = [
  manrope.variable,
  montserrat.variable,
  jetbrainsMono.variable,
  pinyonScript.variable,
].join(" ");
