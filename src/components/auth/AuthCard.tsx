import Link from "next/link";
import { landingFontVariables } from "@/components/landing/fonts";

interface AuthCardProps {
  title: string;
  /** One short line under the title. */
  subtitle?: string;
  footerText: string;
  footerLinkHref: string;
  footerLinkLabel: string;
  /** Rendered inside the landing's modal: just the card, without the full-screen backdrop. */
  modal?: boolean;
  children: React.ReactNode;
}

/**
 * Sign-in / sign-up card in the landing's style: plain white card, hairline
 * border, Onest type. Fields are flattened from here (white, no shadow) so the
 * shared Input keeps its look elsewhere in the app; the forms set their 12px corners.
 */
export function AuthCard({
  title,
  subtitle,
  footerText,
  footerLinkHref,
  footerLinkLabel,
  modal = false,
  children,
}: AuthCardProps) {
  const card = (
    <div
      className={`${landingFontVariables} relative w-full max-w-[420px] overflow-hidden rounded-[18px] border border-foreground/10 bg-white text-[#14262a] shadow-[0_1px_2px_rgba(20,38,42,.04),0_18px_48px_rgba(20,38,42,.12)] [font-family:var(--lf-onest),system-ui,sans-serif] [&_input]:border-foreground/12 [&_input]:bg-white [&_input]:shadow-none`}
    >
      <div className="flex flex-col gap-5 px-7 pt-7 pb-7 sm:px-8">
        <div className="flex flex-col gap-4">
          <span className="mb-logo self-start text-[2.25rem]">formlq</span>
          <div className="flex flex-col gap-1">
            <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
            {subtitle && <p className="text-[15px] text-[#5f777b]">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>

      <div className="border-t border-foreground/10 bg-[#f6f7f7] px-7 py-4 text-center">
        <p className="text-sm text-[#5f777b]">
          {footerText}{" "}
          <Link
            href={footerLinkHref}
            // In the modal, switching login ↔ register must not add a step: closing returns to the landing.
            replace={modal}
            className="font-semibold text-[#14262a] underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
          >
            {footerLinkLabel}
          </Link>
        </p>
      </div>
    </div>
  );
  if (modal) return card;
  return <div className="flex min-h-screen items-center justify-center bg-[#f6f7f7] p-4">{card}</div>;
}
