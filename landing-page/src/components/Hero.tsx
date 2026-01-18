'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Calendar, Sparkles, ArrowRight } from 'lucide-react';

// Lazy load the 3D component for better performance
const SocialCube = dynamic(() => import('./3d/SocialCube'), { ssr: false });

export default function Hero() {
    const handleScheduleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        const element = document.querySelector('#contact');
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
        <section className="relative min-h-screen flex flex-col justify-center overflow-hidden py-12 sm:py-16 lg:py-20" id="hero">
            {/* Enhanced Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
                {/* Multiple Animated Orbs with varying sizes and speeds */}
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] lg:w-[700px] lg:h-[700px] rounded-full bg-gradient-to-br from-[#1E4A8D]/30 to-[#2563eb]/20 blur-3xl animate-float opacity-70" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] rounded-full bg-gradient-to-br from-[#60a5fa]/25 to-[#3b82f6]/15 blur-3xl animate-float-delayed opacity-60" />
                <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-gradient-to-br from-[#1E4A8D]/20 to-transparent blur-2xl animate-float-delayed-2 opacity-50" />
                <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-[#2563eb]/15 to-transparent blur-3xl animate-float opacity-40" />

                {/* Subtle Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(30,74,141,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(30,74,141,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

                {/* Radial gradient overlay for depth */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(30,74,141,0.1),transparent_50%)]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                {/* Split Layout Container */}
                <div className="flex flex-col-reverse lg:flex-row items-center gap-8 lg:gap-12">
                    {/* Left Side - Enhanced Text Content */}
                    <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">

                        {/* Animated Badge */}
                        {/* <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-blue-100/50 shadow-lg shadow-blue-500/10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                            <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                                AI-Powered Customer Support
                            </span>
                        </div> */}

                        {/* Enhanced Headline with Gradient Animation */}
                        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.1] mb-4 sm:mb-5">
                            <span className="text-slate-900">On-demand AI for</span>
                            <br />
                            <span className="relative inline-block mt-1 sm:mt-2">
                                <span className="relative z-10 bg-gradient-to-r from-[#1E4A8D] via-[#2563eb] to-[#1E4A8D] bg-clip-text text-transparent">
                                    Sales and Customer Support
                                </span>
                                {/* Static underline */}
                                <span className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-[#1E4A8D] via-[#2563eb] to-[#1E4A8D] rounded-full opacity-30 blur-sm" />
                            </span>
                        </h1>

                        {/* Enhanced Subheadline in Glassmorphic Card */}
                        <div className="mb-5 sm:mb-6 p-3 sm:p-4 rounded-xl bg-white/60 backdrop-blur-xl border border-white/60 shadow-xl shadow-blue-500/5 max-w-xl">
                            <p className="text-sm sm:text-base lg:text-lg text-slate-700 leading-relaxed font-medium">
                                Step in when needed, stay invisible when not.
                                <br />
                                <span className="text-blue-600 font-semibold">Active when your team is offline or overloaded.</span>
                            </p>
                        </div>

                        {/* Enhanced CTA with Glow Effect */}
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <a
                                href="#contact"
                                onClick={handleScheduleClick}
                                className="group relative px-6 py-3 bg-gradient-to-r from-[#1E4A8D] via-[#2563eb] to-[#1E4A8D] bg-[length:200%_auto] text-white font-bold rounded-xl transition-all duration-500 shadow-2xl shadow-blue-500/50 hover:shadow-blue-500/70 hover:scale-105 overflow-hidden text-base w-full sm:w-auto animate-gradient"
                            >
                                {/* Animated shimmer effect */}
                                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                                {/* Pulsing glow */}
                                <div className="absolute inset-0 rounded-xl bg-blue-400 blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500 -z-10" />

                                <span className="relative flex items-center justify-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Schedule a Demo
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </a>
                        </div>
                    </div>

                    {/* Right Side - Enhanced 3D Cube with Glow */}
                    <div className="w-full lg:w-1/2 h-[280px] sm:h-[350px] lg:h-[500px] relative animate-in fade-in zoom-in-50 duration-1000 delay-300">
                        {/* Glowing backdrop */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl scale-75 animate-pulse-glow" />

                        <Suspense fallback={
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    <div className="absolute inset-0 w-16 h-16 border-4 border-blue-300 border-t-transparent rounded-full animate-spin opacity-30" style={{ animationDirection: 'reverse', animationDuration: '1s' }} />
                                </div>
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
