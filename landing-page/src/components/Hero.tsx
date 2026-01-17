'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Calendar } from 'lucide-react';

// Lazy load the 3D component for better performance
const SocialCube = dynamic(() => import('./3d/SocialCube'), { ssr: false });

export default function Hero() {
    const handleScheduleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        const element = document.querySelector('#demo');
        if (element) {
            const offset = 80;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    return (
        <section className="relative min-h-screen flex flex-col justify-center overflow-hidden py-20 lg:py-28" id="hero">
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#EBF2FA] via-white to-[#FBF6E8]">
                {/* Animated Orbs */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] rounded-full bg-gradient-to-br from-[#1E4A8D]/20 to-[#1E4A8D]/10 blur-3xl animate-float opacity-60" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] lg:w-[700px] lg:h-[700px] rounded-full bg-gradient-to-br from-[#D4AF37]/30 to-[#D4AF37]/20 blur-3xl animate-float-delayed opacity-60" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-[#1E4A8D]/15 to-[#D4AF37]/10 blur-3xl animate-float-delayed-2 opacity-40" />

                {/* Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                {/* Split Layout Container */}
                <div className="flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-8">
                    {/* Left Side - Text Content */}
                    <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">

                        {/* Headline */}
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-6">
                            On-demand AI for <br />
                            <span className="text-gradient">Sales and Customer Support</span>
                        </h1>

                        {/* Subheadline */}
                        <p className="text-lg lg:text-xl text-gray-600 leading-relaxed max-w-xl mb-8">
                            Step in when needed, stay invisible when not.<br/> Active when your team is offline or overloaded.
                        </p>

                        {/* CTA */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-10 w-full sm:w-auto">
                            <a
                                href="#demo"
                                onClick={handleScheduleClick}
                                className="group relative px-8 py-4 bg-gradient-to-r from-[#1E4A8D] to-[#2563eb] text-white font-bold rounded-full transition-all duration-300 shadow-2xl shadow-blue-500/40 hover:shadow-blue-500/60 hover:scale-105 overflow-hidden text-lg w-full sm:w-auto"
                            >
                                {/* Shimmer effect */}
                                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                                <span className="relative flex items-center justify-center gap-3">
                                    <Calendar className="w-5 h-5" />
                                    Schedule a Demo
                                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </span>
                            </a>
                        </div>
                    </div>

                    {/* Right Side - 3D Cube */}
                    <div className="w-full lg:w-1/2 h-[400px] lg:h-[600px] relative">
                        <Suspense fallback={
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                        }>
                            <SocialCube />
                        </Suspense>
                    </div>
                </div>
            </div>
        </section>
    );
}
