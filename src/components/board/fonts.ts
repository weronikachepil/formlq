import { JetBrains_Mono, Manrope, Marck_Script, Montserrat } from "next/font/google";

// Fonts of the mathboard design (board.css reads them through these variables). The canvas also
// draws with Manrope and Marck Script; the engine reads their variables from `.mathboard`.

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

/** Handwriting font for canvas text objects (--font-marck-script). */
const marckScript = Marck_Script({
  variable: "--font-marck-script",
  subsets: ["latin", "cyrillic"],
  weight: "400",
});

/** Class names of the board's CSS fonts; put them on the `.mathboard` root. Declared here, not in the
 *  root layout, so only board pages download them. */
export const boardFonts = [manrope, montserrat, jetbrainsMono, marckScript].map((f) => f.variable).join(" ");

