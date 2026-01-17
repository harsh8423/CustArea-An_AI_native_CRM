import React from 'react';
import { ArrowRight, Linkedin } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="bg-slate-950 text-white pt-24 pb-12 overflow-hidden relative">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent opacity-50"></div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">

                {/* Massive CTA Section */}
                <div className="mb-12 md:mb-24 flex flex-col md:flex-row items-start md:items-end justify-between gap-8 sm:gap-12 border-b border-slate-900 pb-12">
                    <div className="max-w-3xl">
                        <h2 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-['Outfit'] font-bold tracking-tight leading-[0.9] mb-6 sm:mb-8 text-white">
                            Ready to <span className="text-blue-500">scale</span><br />
                            your support?
                        </h2>
                        <p className="text-lg sm:text-xl md:text-2xl text-slate-400 max-w-xl leading-relaxed">
                            Join forward-thinking companies using CustArea to automate conversations and close more deals.
                        </p>
                    </div>
                    <div className="flex flex-col gap-4 w-full md:w-auto">
                        <button className="group bg-white text-slate-950 px-6 sm:px-8 py-3 sm:py-4 rounded-full text-base sm:text-lg font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-2 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-10px_rgba(255,255,255,0.5)] hover:scale-105 duration-300 min-h-[48px]">
                            Get Started Now <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <p className="text-slate-500 text-xs sm:text-sm text-center md:text-right">No credit card required</p>
                    </div>
                </div>

                {/* Massive Brand Section */}
                <div className="mb-0 flex flex-col items-center text-center w-full">
                    <div className="flex items-center justify-center w-full">
                        <span className="text-[clamp(3.5rem,_15vw,_15vw)] font-['Outfit'] font-bold tracking-tighter leading-none select-none">
                            <span className="text-[#1E4A8D]">Cust</span>
                            <span className="text-white">Area</span>
                        </span>
                    </div>

                    <div className="flex gap-4 pt-6 sm:pt-8 pb-10 sm:pb-12 justify-center">
                        <a href="#" className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:bg-[#0077b5] hover:text-white hover:border-[#0077b5] transition-all duration-300 group min-h-[56px] min-w-[56px]">
                            <Linkedin className="w-7 h-7 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform" />
                        </a>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-slate-500 text-sm font-medium">
                        © {new Date().getFullYear()} CustArea Inc. All rights reserved.
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-slate-400 text-sm font-medium">All systems operational</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
