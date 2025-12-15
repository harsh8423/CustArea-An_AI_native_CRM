import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/sections/hero";
import { Features } from "@/components/sections/features";
import { VirtualReceptionist } from "@/components/sections/virtual-receptionist";
import { UseCases } from "@/components/sections/use-cases";
import { HowItWorks } from "@/components/sections/how-it-works";

export default function Home() {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden selection:bg-primary/30">
      <Navbar />
      <Hero />
      <Features />
      <VirtualReceptionist />
      <HowItWorks />
      <UseCases />
      <Footer />
    </main>
  );
}
