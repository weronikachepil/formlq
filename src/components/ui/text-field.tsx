import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** Shared look for app text inputs/textareas (MathBoard white-glass field, ink focus edge). */
export const fieldClass = cn(
  "w-full rounded-[12px] border border-glass-edge bg-glass text-sm outline-none transition-colors",
  "placeholder:text-muted-foreground/70 hover:bg-glass-strong focus:bg-glass-strong focus:border-foreground/50 focus:ring-2 focus:ring-ring/15",
  "disabled:opacity-50 disabled:cursor-not-allowed",
);

// Fields share one 12px corner (buttons stay round).
const inputSizes = { sm: "h-8 px-3.5 rounded-[10px]", md: "h-10 px-4 rounded-[12px]" } as const;

interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: keyof typeof inputSizes;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { size = "md", className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(fieldClass, inputSizes[size], className)} {...props} />;
});

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Monospace — for LaTeX / formula sources. */
  mono?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { mono, className, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(fieldClass, "px-4 py-2.5 resize-y leading-relaxed", mono && "font-mono text-xs", className)}
      {...props}
    />
  );
});
