// Copies MathLive fonts and its static stylesheet into public/ so formulas on the
// board render without a CDN (quiz cards and PNG/PDF export load the stylesheet).
import { cpSync, existsSync, mkdirSync } from "node:fs";

const fonts = "node_modules/mathlive/fonts";
if (existsSync(fonts)) {
  mkdirSync("public/mathlive-fonts", { recursive: true });
  cpSync(fonts, "public/mathlive-fonts", { recursive: true });
  cpSync("node_modules/mathlive/mathlive-static.css", "public/mathlive-static.css");
  console.log("MathLive fonts and static css copied to public/");
} else {
  console.log("MathLive fonts not found, skipping");
}
