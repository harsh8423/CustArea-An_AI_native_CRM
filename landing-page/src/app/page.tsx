import {
  Header,
  Hero,
  Features,
  HowItWorks,
  AIShowcase,
  DemoSection,
  ContactForm,
  FAQ,
  Footer
} from '@/components';

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <AIShowcase />
      <DemoSection />
      <ContactForm />
      <FAQ />
      <Footer />
    </main>
  );
}
