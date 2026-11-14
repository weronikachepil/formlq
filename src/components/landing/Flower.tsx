import type { CSSProperties } from "react";

interface FlowerProps {
  tone?: "lav" | "mint" | "peach";
  style?: CSSProperties;
}

/** Decorative eight-petal blob that sits behind card content. */
export function Flower({ tone = "lav", style }: FlowerProps) {
  const className = tone === "lav" ? "flower" : `flower ${tone}`;
  return <span className={className} style={style} />;
}
