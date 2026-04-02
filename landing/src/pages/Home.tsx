import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { SocialProof } from "@/components/SocialProof";
import { PainSection } from "@/components/PainSection";
import { SolutionSection } from "@/components/SolutionSection";
import { FeaturesGrid } from "@/components/FeaturesGrid";
import { ExperienceSection } from "@/components/ExperienceSection";
import { TechStrip } from "@/components/TechStrip";
import { ComparisonTable } from "@/components/ComparisonTable";
import { PricingSection } from "@/components/PricingSection";
import { FaqSection } from "@/components/FaqSection";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden text-slate-900 dark:text-slate-100 selection:bg-blue-500/25">
      <Header />
      <main>
        <Hero />
        <SocialProof />
        <PainSection />
        <SolutionSection />
        <FeaturesGrid />
        <ExperienceSection />
        <TechStrip />
        <ComparisonTable />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
