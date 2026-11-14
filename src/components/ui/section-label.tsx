import { cn } from "@/lib/utils";

interface SectionLabelProps extends React.HTMLAttributes<HTMLElement> {
  /** "xs" = form/section captions, "2xs" = compact list group headers. */
  size?: "xs" | "2xs";
  as?: "p" | "label" | "h3" | "span";
  htmlFor?: string;
}

/** Small uppercase caption used above form fields and list groups. */
export function SectionLabel({
  size = "xs",
  as: Tag = "p",
  className,
  ...props
}: SectionLabelProps) {
  return (
    <Tag
      className={cn(
        "uppercase text-muted-foreground",
        // MathBoard `.label`: small, semibold, widely tracked.
        size === "xs"
          ? "text-xs font-semibold tracking-[0.16em]"
          : "text-[10px] font-semibold tracking-[0.18em] px-1",
        className,
      )}
      {...props}
    />
  );
}
