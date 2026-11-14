import type { CSSProperties } from "react";

interface TicksProps {
  items: string[];
  style?: CSSProperties;
}

/** Checklist with round dark tick bullets. */
export function Ticks({ items, style }: TicksProps) {
  return (
    <ul className="ticks" style={style}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
