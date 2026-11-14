import Link from "next/link";

interface AuthCardProps {
  title: string;
  footerText: string;
  footerLinkHref: string;
  footerLinkLabel: string;
  children: React.ReactNode;
}

/** MathBoard sign-in card: big-radius white glass with a lavender flower and the handwritten logo. */
export function AuthCard({ title, footerText, footerLinkHref, footerLinkLabel, children }: AuthCardProps) {
  return (
    <div className="mb-dots min-h-screen flex items-center justify-center p-4">
      <div className="mb-flower relative w-full max-w-[420px] overflow-hidden rounded-[2.25rem] border border-glass-edge bg-card shadow-glass-lg backdrop-blur-xl">
        <div className="relative z-10 px-7 pt-8 pb-7 sm:px-9 flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Підготовка до НМТ з математики
            </p>
            <span className="mb-logo text-[2.6rem] self-start">formlq</span>
          </div>
          <h1 className="font-heading text-2xl font-extrabold uppercase leading-tight">{title}</h1>
          {children}
        </div>

        <div className="relative z-10 px-7 py-4 border-t border-foreground/8 text-center">
          <p className="text-sm text-muted-foreground">
            {footerText}{" "}
            <Link
              href={footerLinkHref}
              className="text-foreground font-semibold underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
            >
              {footerLinkLabel}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
