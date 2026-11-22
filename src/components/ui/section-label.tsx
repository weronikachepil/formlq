import { cn } from "@/lib/utils";

interface SectionLabelProps extends React.HTMLAttributes<HTMLElement> {
  /** "xs" = form/section captions, "2xs" = compact list group headers. */
  size?: "xs" | "2xs";
  as?: "p" | "label" | "h3" | "span";
  htmlFor?: string;
}

/** Small muted caption used above form fields and list groups (sentence case). */
export function SectionLabel({
  size = "xs",
  as: Tag = "p",
  className,
  ...props
}: SectionLabelProps) {
  return (
    <Tag
      className={cn(
        "text-muted-foreground",
        size === "xs" ? "text-[13px] font-semibold" : "text-xs font-semibold px-1",
        className,
      )}
      {...props}
    />
  );
}
