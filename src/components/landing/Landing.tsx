import "./landing.css";
import "../advent/advent-promo.css";
import { landingFontVariables } from "./fonts";
import { LandingNav } from "./LandingNav";
import { Hero } from "./Hero";
import { TestsSection } from "./TestsSection";
import { Features } from "./Features";
import { Audience } from "./Audience";
import { HowItWorks } from "./HowItWorks";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { LandingFooter } from "./LandingFooter";
import { AdventLandingBar } from "../advent/AdventPromo";

/** Public marketing landing page. Server component; all styles scoped under `.landing`. */
export function Landing() {
  return (
    <div className={`landing ${landingFontVariables}`}>
      <AdventLandingBar />
      <LandingNav />
      <Hero />
      <TestsSection />
      <Features />
      <Audience />
      <HowItWorks />
      <Faq />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}
