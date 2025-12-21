import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <header className="px-8 py-6 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-white rounded-lg"></div>
                    <span className="font-bold text-xl tracking-tight">CRM</span>
                </div>
                <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                    <Link href="#" className="hover:text-white transition">Product</Link>
                    <Link href="#" className="hover:text-white transition">Solutions</Link>
                    <Link href="#" className="hover:text-white transition">Pricing</Link>
                    <Link href="#" className="hover:text-white transition">Resources</Link>
                </nav>
                <div className="flex items-center gap-4">
                    <Link href="/login" className="text-sm font-medium hover:text-gray-300 transition">Log in</Link>
                    <Link href="/register" className="bg-white text-black px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-200 transition">
                        Start free trial
                    </Link>
                </div>
            </header>

            {/* Hero Section */}
            <main className="flex-1 flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800/20 via-black to-black pointer-events-none"></div>

                <div className="relative z-10 max-w-4xl mx-auto space-y-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-gray-300 backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        New: AI-powered workflows
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
                        Customer relationships, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">reimagined with AI.</span>
                    </h1>

                    <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        The only CRM that combines powerful automation with a beautiful, intuitive interface. Built for teams that move fast.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <Link href="/register" className="h-12 px-8 rounded-full bg-white text-black font-semibold flex items-center gap-2 hover:bg-gray-200 transition">
                            Get Started Free
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="#" className="h-12 px-8 rounded-full border border-white/20 hover:bg-white/10 transition flex items-center font-medium">
                            View Demo
                        </Link>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/10 py-8 text-center text-gray-500 text-sm">
                <p>&copy; 2025 CRM Inc. All rights reserved.</p>
            </footer>
        </div>
    );
}
