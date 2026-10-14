import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SiteFooter } from "@/components/landing/site-footer";
import { UploadSection } from "@/components/landing/upload-section";
import { WontFlag } from "@/components/landing/wont-flag";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <WontFlag />
        <HowItWorks />
        <UploadSection />
      </main>
      <SiteFooter />
    </>
  );
}
