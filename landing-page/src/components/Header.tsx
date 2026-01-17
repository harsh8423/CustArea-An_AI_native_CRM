'use client';

import { useState, useEffect } from 'react';
import { Calendar, Menu, X } from 'lucide-react';

export default function Header() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { href: '#features', label: 'Features' },
        { href: '#how-it-works', label: 'How It Works' },
        { href: '#ai-showcase', label: 'AI Platform' },
        { href: '#faq', label: 'FAQ' },
    ];

    const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        e.preventDefault();
        const element = document.querySelector(href);
        if (element) {
            const offset = 80;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            setMobileMenuOpen(false);
        }
    };

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'px-4 sm:px-6 lg:px-8 pt-4' : 'px-0 pt-0'}`}>
            {/* Navbar Container - Transforms on scroll */}
            <div
                className={`mx-auto transition-all duration-500 ease-in-out ${scrolled
                        ? 'max-w-6xl bg-white/80 backdrop-blur-2xl shadow-2xl shadow-slate-300/20 border border-slate-200/60 rounded-full px-4 md:px-6'
                        : 'max-w-7xl bg-transparent px-4 sm:px-6 lg:px-8'
                    }`}
            >
                <div className={`flex items-center justify-between transition-all duration-500 ${scrolled ? 'h-14 md:h-16' : 'h-16'}`}>
                    {/* Logo */}
                    <a
                        href="/"
                        className="flex items-center gap-2 group transition-transform duration-300 hover:scale-105"
                    >
                        <div className="relative">
                            <img
                                src="/logo.png"
                                alt="CustArea"
                                className={`object-contain transition-all duration-500 group-hover:rotate-12 ${scrolled ? 'w-8 h-8 md:w-10 md:h-10' : 'w-9 h-9 md:w-11 md:h-11'}`}
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-amber-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
                        </div>
                        <span className={`font-['Outfit'] font-bold transition-all duration-500 ${scrolled ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'}`}>
                            <span className="text-[#1E4A8D] transition-colors duration-300">Cust</span>
                            <span className="text-[#D4AF37] transition-colors duration-300">Area</span>
                        </span>
                    </a>

                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center gap-1">
                        {navLinks.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                onClick={(e) => handleNavClick(e, link.href)}
                                className={`relative px-3 py-1.5 text-sm font-medium transition-all duration-300 group ${scrolled
                                        ? 'text-slate-700 hover:text-[#1E4A8D] hover:bg-white/90 hover:shadow-md rounded-full'
                                        : 'text-slate-800 hover:text-[#1E4A8D]'
                                    }`}
                            >
                                <span className="relative z-10">{link.label}</span>
                                {/* Animated underline */}
                                <span className={`absolute left-1/2 -translate-x-1/2 h-0.5 bg-gradient-to-r from-[#1E4A8D] to-[#D4AF37] rounded-full group-hover:w-3/4 transition-all duration-300 ${scrolled ? 'bottom-1 w-0' : 'bottom-0 w-0'
                                    }`} />
                            </a>
                        ))}
                    </nav>

                    {/* CTA Button - Schedule Demo */}
                    <div className="hidden lg:flex items-center">
                        <a
                            href="#demo"
                            onClick={(e) => handleNavClick(e, '#demo')}
                            className={`group relative bg-gradient-to-r from-[#1E4A8D] to-[#2563eb] text-white font-semibold rounded-full transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/50 hover:scale-105 overflow-hidden ${scrolled ? 'px-5 py-2.5' : 'px-5 py-2'
                                }`}
                        >
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                            <span className="relative flex items-center gap-2 text-sm font-['Inter']">
                                <Calendar className="w-4 h-4" />
                                Schedule Demo
                            </span>
                        </a>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className={`lg:hidden p-2 rounded-full transition-all duration-300 hover:scale-105 ${scrolled ? 'hover:bg-slate-100/50' : 'hover:bg-white/20'
                            }`}
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? (
                            <X className="w-5 h-5 text-slate-700" />
                        ) : (
                            <Menu className="w-5 h-5 text-slate-700" />
                        )}
                    </button>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className={`lg:hidden pb-4 animate-in slide-in-from-top-2 duration-300 ${scrolled ? '' : 'bg-white/95 backdrop-blur-md rounded-2xl mt-2 shadow-xl'}`}>
                        <nav className="flex flex-col gap-1 pt-2">
                            {navLinks.map((link) => (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    onClick={(e) => handleNavClick(e, link.href)}
                                    className="py-2.5 px-4 text-slate-700 hover:text-[#1E4A8D] hover:bg-slate-50 rounded-full transition-all duration-200 font-medium"
                                >
                                    {link.label}
                                </a>
                            ))}
                            <a
                                href="#demo"
                                onClick={(e) => handleNavClick(e, '#demo')}
                                className="mt-2 py-2.5 px-5 bg-gradient-to-r from-[#1E4A8D] to-[#2563eb] text-white font-semibold rounded-full transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
                            >
                                <Calendar className="w-4 h-4" />
                                Schedule Demo
                            </a>
                        </nav>
                    </div>
                )}
            </div>
        </header>
    );
}
