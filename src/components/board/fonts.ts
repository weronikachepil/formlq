import { JetBrains_Mono, Manrope, Montserrat } from "next/font/google";

// Fonts of the mathboard design (board.css reads them through these variables).
// Canvas text fonts (Comfortaa, Marck Script) are loaded app-wide in the root layout,
// because the engine reads their variables from <html>.

/** Body / panels / quiz cards. */
const manrope = Manrope({
  variable: "--mb-font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

/** Headings and the board title. */
const montserrat = Montserrat({
  variable: "--mb-font-montserrat",
  subsets: ["latin", "cyrillic"],
  weight: ["700", "800", "900"],
});

/** Numbers: zoom, counters, scores. */
const jetbrainsMono = JetBrains_Mono({
  variable: "--mb-font-jetbrains",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
});

/** Class names of the board's CSS fonts; put them on the `.mathboard` root. */
export const boardFonts = [manrope, montserrat, jetbrainsMono].map((f) => f.variable).join(" ");

