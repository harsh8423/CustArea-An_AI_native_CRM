import {
  Header,
  Hero,
  UnifiedPlatform,
  Features,
  HowItWorks,
  AIShowcase,
  ContactAndDemo,
  FAQ,
  Footer,
  FeaturesGrid
} from '@/components';

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <UnifiedPlatform />
      <Features />
      <HowItWorks />
      <AIShowcase />
      <FeaturesGrid />
      <ContactAndDemo />
      <FAQ />
      <Footer />
    </main>
  );
}
