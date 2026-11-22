import { Onest, Pinyon_Script } from "next/font/google";

// Fonts used only by the landing page. Applied on the `.landing` root via
// CSS variables, referenced from ./landing.css.

// One round geometric family for headings and text: clean and easy to read.
const onest = Onest({
  variable: "--lf-onest",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Pinyon Script has no Cyrillic subset on Google Fonts; it is used only for
// the Latin «formlq» logo.
const pinyonScript = Pinyon_Script({
  variable: "--lf-pinyon",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const landingFontVariables = [
  onest.variable,
  pinyonScript.variable,
].join(" ");
