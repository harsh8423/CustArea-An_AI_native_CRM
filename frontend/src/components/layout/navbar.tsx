"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, X, Bot } from "lucide-react";

export function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                isScrolled
                    ? "bg-background/80 backdrop-blur-md border-b border-white/10 py-4"
                    : "bg-transparent py-6"
            )}
        >
            <Container>
                <nav className="flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-accent shadow-lg transition-transform group-hover:scale-105">
                            <Bot className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white">
                            Nexus<span className="text-primary">AI</span>
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        <Link
                            href="#features"
                            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                        >
                            Features
                        </Link>
                        <Link
                            href="#solutions"
                            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                        >
                            Solutions
                        </Link>
                        <Link
                            href="#pricing"
                            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                        >
                            Pricing
                        </Link>
                        <Link
                            href="/playground"
                            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                        >
                            Playground
                        </Link>
                        <Link
                            href="/demo"
                            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                        >
                            Demo
                        </Link>
                        <Link
                            href="/call"
                            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                        >
                            Call
                        </Link>
                        <Button variant="glow" size="sm">
                            Get Started
                        </Button>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="md:hidden p-2 text-muted-foreground hover:text-white"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X /> : <Menu />}
                    </button>
                </nav>
            </Container>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-white/10 p-4 animate-in slide-in-from-top-5">
                    <div className="flex flex-col gap-4">
                        <Link
                            href="#features"
                            className="text-base font-medium text-muted-foreground hover:text-white"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Features
                        </Link>
                        <Link
                            href="#solutions"
                            className="text-base font-medium text-muted-foreground hover:text-white"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Solutions
                        </Link>
                        <Link
                            href="#pricing"
                            className="text-base font-medium text-muted-foreground hover:text-white"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Pricing
                        </Link>
                        <Link
                            href="/playground"
                            className="text-base font-medium text-muted-foreground hover:text-white"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Playground
                        </Link>
                        <Link
                            href="/demo"
                            className="text-base font-medium text-muted-foreground hover:text-white"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Demo
                        </Link>
                        <Link
                            href="/call"
                            className="text-base font-medium text-muted-foreground hover:text-white"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            Call
                        </Link>
                        <Button variant="glow" className="w-full">
                            Get Started
                        </Button>
                    </div>
                </div>
            )}
        </header>
    );
}
