import "./landing.css";
import { landingFontVariables } from "./fonts";
import { LandingNav } from "./LandingNav";
import { Hero } from "./Hero";
import { Products } from "./Products";
import { QuizPreview } from "./QuizPreview";
import { Features } from "./Features";
import { HowItWorks } from "./HowItWorks";
import { Audience } from "./Audience";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { LandingFooter } from "./LandingFooter";

/** Public marketing landing page. Server component; all styles scoped under `.landing`. */
export function Landing() {
  return (
    <div className={`landing ${landingFontVariables}`}>
      <LandingNav />
      <Hero />
      <Products />
      <QuizPreview />
      <Features />
      <HowItWorks />
      <Audience />
      <Faq />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}
