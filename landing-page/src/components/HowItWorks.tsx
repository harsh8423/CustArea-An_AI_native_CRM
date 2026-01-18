"use client";
import React, { useRef, useState, useEffect } from 'react';
import { STEPS } from '../constants';
import { Check, MessageSquare, Bot, Inbox } from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';

const HowItWorks: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeStep, setActiveStep] = useState(0);
    const [progress, setProgress] = useState(0);

    // Timer to update progress only - no step changes here
    useEffect(() => {
        const duration = 3000; // 3 seconds per step
        const intervalTime = 50; // Update every 50ms
        const increment = 100 / (duration / intervalTime);

        const timer = setInterval(() => {
            setProgress((prev) => {
                const next = prev + increment;
                return next > 100 ? 100 : next; // Cap at 100
            });
        }, intervalTime);

        return () => clearInterval(timer);
    }, []); // Run once, never restart

    // Watch progress and advance step when complete
    useEffect(() => {
        if (progress >= 100) {
            setActiveStep((prev) => (prev + 1) % STEPS.length);
            setProgress(0); // Reset for next step
        }
    }, [progress]);

    // Handle manual step click
    const handleStepClick = (index: number) => {
        setActiveStep(index);
        setProgress(0); // Reset progress manually
    };


    return (
        <div className="relative bg-white" id="how-it-works">
            {/* Main content */}
            <div className="w-full py-12 md:py-24">
                <div className="w-full max-w-5xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row gap-4 md:gap-8 items-start">

                    {/* Left Side: Navigation & Text */}
                    <div className="w-full md:w-1/2 flex flex-col justify-center z-10 h-1/2 md:h-auto">
                        <div className="mb-6 md:mb-10 text-center">
                            <span className="inline-block py-1 px-3 rounded-full bg-blue-50 text-blue-600 font-bold text-[10px] md:text-xs tracking-widest uppercase mb-3 md:mb-4 border border-blue-100">
                                How It Works
                            </span>
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-['Outfit'] font-bold mb-3 md:mb-4 text-slate-900 leading-tight">
                                Go live in <br />
                                <span className="text-gradient">{STEPS.length} simple steps</span>
                            </h2>
                            <p className="text-sm md:text-base lg:text-base text-slate-500 max-w-sm font-['Inter'] mx-auto">
                                From sign-up to your first AI-powered conversation in hours, not weeks.
                            </p>
                        </div>

                        <div className="space-y-3 md:space-y-4 relative pl-2">
                            {/* Connected Line (Background) */}
                            <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-100 -z-10" />

                            {STEPS.map((step, index) => {
                                const isActive = index === activeStep;
                                return (
                                    <motion.div
                                        key={step.id}
                                        className={`relative p-3 md:p-4 rounded-xl md:rounded-2xl cursor-pointer transition-all duration-300 border ${isActive
                                            ? 'bg-white shadow-lg md:shadow-xl border-slate-100 scale-100 opacity-100 z-10'
                                            : 'bg-transparent border-transparent opacity-60 hover:opacity-100 hover:bg-slate-50'
                                            }`}
                                        onClick={() => handleStepClick(index)}
                                        animate={{
                                            opacity: isActive ? 1 : 0.6,
                                        }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        {/* Progress Bar for Active Step */}
                                        {isActive && (
                                            <div className="absolute bottom-0 left-3 md:left-4 right-3 md:right-4 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-600 transition-all duration-100 ease-linear"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        )}

                                        <div className="flex gap-3 md:gap-4">
                                            {/* Step Number Circle */}
                                            <motion.div
                                                className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-xs md:text-sm shrink-0 border-2 transition-colors duration-300 ${isActive
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'
                                                    : index < activeStep
                                                        ? 'bg-green-500 text-white border-green-500'
                                                        : 'bg-white text-slate-400 border-slate-200'
                                                    }`}
                                                animate={{
                                                    scale: isActive ? 1.1 : 1
                                                }}
                                            >
                                                {index < activeStep ? <Check className="w-4 h-4" /> : `0${step.id}`}
                                            </motion.div>

                                            {/* Text Content */}
                                            <div className="flex-1">
                                                <h3 className={`text-base md:text-lg lg:text-lg font-bold mb-0.5 md:mb-1 font-['Outfit'] ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                                                    {step.title}
                                                </h3>

                                                {/* Expandable Description */}
                                                <div
                                                    className={`grid transition-all duration-300 ease-in-out ${isActive ? 'grid-rows-[1fr] mt-2 mb-4' : 'grid-rows-[0fr]'
                                                        }`}
                                                >
                                                    <div className="overflow-hidden">
                                                        <p className="text-xs md:text-sm lg:text-sm text-slate-600 leading-relaxed mb-2 md:mb-3 font-['Inter'] max-w-sm">
                                                            {step.description}
                                                        </p>
                                                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-2 md:gap-y-1.5 md:gap-x-4">
                                                            {step.checklist.map((item, i) => (
                                                                <li key={i} className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs lg:text-xs text-slate-500 font-medium font-['Inter']">
                                                                    <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-green-500" />
                                                                    {item}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Side: Dynamic Visuals - Sticky */}
                    <div className="hidden md:flex w-full md:w-1/2 bg-white sticky top-48 self-start items-center justify-center p-4 overflow-hidden rounded-3xl h-fit">
                        {/* Background Decor */}
                        <div className="absolute inset-0 bg-[radial-gradient(#e0e7ff_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />

                        {/* Static Glowing Orbs (Performance Optimized) */}
                        <div className="absolute top-1/4 left-1/4 w-40 h-40 bg-blue-400/10 rounded-full blur-[50px]" />
                        <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-indigo-400/10 rounded-full blur-[50px]" />

                        {/* Phone Mockup - Compact Size */}
                        <div className="relative w-full max-w-[200px] md:max-w-[280px] aspect-[9/16] bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-xl border-4 border-slate-900 overflow-hidden ring-1 ring-slate-900/5">
                            {/* Phone Notch/Header */}
                            <div className="absolute top-0 inset-x-0 h-4 md:h-5 bg-slate-900 rounded-b-lg mx-auto w-16 md:w-20 z-20" />

                            {/* Dynamic Screen Content */}
                            <div className="absolute inset-0 bg-slate-50 flex flex-col pt-6 md:pt-8">

                                {/* Screen Header (Static) */}
                                <div className="px-3 md:px-4 pb-2 md:pb-3 border-b border-slate-100 flex justify-between items-center bg-white">
                                    <div className="text-[8px] md:text-[10px] font-bold text-slate-900 font-['Outfit']">CustArea Agent</div>
                                    <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-green-500" />
                                </div>

                                {/* Transitioning Content Area */}
                                <div className="flex-1 relative overflow-hidden p-3 md:p-4">
                                    <AnimatePresence mode="wait">
                                        {activeStep === 0 && (
                                            <motion.div
                                                key="step1"
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                transition={{ duration: 0.3 }}
                                                className="flex flex-col gap-2 md:gap-2.5 h-full justify-center"
                                            >
                                                {[
                                                    { icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-100', title: 'WhatsApp API', status: 'Connected' },
                                                    { icon: Inbox, color: 'text-blue-600', bg: 'bg-blue-100', title: 'Email SMTP', status: 'Connected' },
                                                    { icon: Bot, color: 'text-indigo-600', bg: 'bg-indigo-100', title: 'Web Widget', status: 'Active' }
                                                ].map((item, i) => (
                                                    <div key={i} className="bg-white p-2 md:p-2.5 rounded-lg shadow-sm border border-slate-100 flex items-center gap-2 md:gap-2.5">
                                                        <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full ${item.bg} flex items-center justify-center ${item.color}`}>
                                                            <item.icon className="w-3 md:w-3.5 h-3 md:h-3.5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-[8px] md:text-[10px] font-['Inter']">{item.title}</div>
                                                            <div className={`text-[7px] md:text-[9px] ${item.color} font-medium`}>{item.status}</div>
                                                        </div>
                                                        <div className="ml-auto">
                                                            <div className={`w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-green-500 border-2 border-white shadow-sm`} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}

                                        {activeStep === 1 && (
                                            <motion.div
                                                key="step2"
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ duration: 0.3 }}
                                                className="flex flex-col justify-center items-center text-center h-full"
                                            >
                                                <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-2 md:mb-3 text-indigo-600">
                                                    <Bot className="w-5 h-5 md:w-6 md:h-6" />
                                                </div>
                                                <h4 className="font-bold text-xs md:text-sm mb-1.5 md:mb-2 font-['Outfit']">Training AI...</h4>
                                                <div className="w-full bg-slate-100 rounded-full h-1 mb-2 md:mb-3 overflow-hidden">
                                                    <motion.div
                                                        className="bg-indigo-600 h-full rounded-full"
                                                        initial={{ width: "0%" }}
                                                        animate={{ width: "75%" }}
                                                        transition={{ duration: 1, ease: "easeInOut" }}
                                                    />
                                                </div>
                                                <div className="space-y-1 md:space-y-1.5 w-full">
                                                    {['knowledge_base.pdf', 'pricing_tier.docx'].map((file, i) => (
                                                        <div key={i} className="bg-white p-1.5 md:p-2 rounded border border-slate-100 text-[8px] md:text-[9px] flex justify-between font-['Inter']">
                                                            <span>{file}</span>
                                                            <span className="text-green-600 font-bold">Parsed</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}

                                        {activeStep === 2 && (
                                            <motion.div
                                                key="step3"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                                className="h-full flex flex-col justify-center"
                                            >
                                                <div className="relative h-40 md:h-48 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 p-2">
                                                    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white px-1.5 md:px-2 py-0.5 md:py-1 rounded shadow-sm text-[8px] md:text-[9px] font-bold border border-green-200 text-green-700 font-['Inter']">
                                                        Trigger: New Msg
                                                    </div>
                                                    <div className="absolute top-6 md:top-8 left-1/2 -translate-x-1/2 w-0.5 h-3 md:h-4 bg-slate-300" />

                                                    <div className="absolute top-10 md:top-12 left-1/2 -translate-x-1/2 bg-indigo-600 px-1.5 md:px-2 py-0.5 md:py-1 rounded shadow-sm text-[8px] md:text-[9px] font-bold text-white flex items-center gap-1 font-['Inter']">
                                                        <Bot className="w-2 md:w-2.5 h-2 md:h-2.5" />
                                                        AI Analysis
                                                    </div>
                                                    <div className="absolute top-16 md:top-20 left-1/2 -translate-x-1/2 w-full max-w-[60px] md:max-w-[80px] h-3 md:h-4 border-t-2 border-x-2 border-slate-300 rounded-t-lg" />

                                                    <div className="absolute top-20 md:top-24 left-2 md:left-4 bg-white px-1.5 md:px-2 py-0.5 md:py-1 rounded shadow-sm text-[7px] md:text-[8px] font-medium border border-slate-200 font-['Inter']">
                                                        Reply (FAQ)
                                                    </div>
                                                    <div className="absolute top-20 md:top-24 right-2 md:right-4 bg-white px-1.5 md:px-2 py-0.5 md:py-1 rounded shadow-sm text-[7px] md:text-[8px] font-medium border border-slate-200 font-['Inter']">
                                                        Escalate
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {activeStep === 3 && (
                                            <motion.div
                                                key="step4"
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ duration: 0.3 }}
                                                className="flex flex-col justify-center gap-2 md:gap-3 h-full"
                                            >
                                                <div className="bg-indigo-600 rounded-lg p-3 md:p-4 text-white shadow-lg">
                                                    <div className="text-indigo-200 text-[8px] md:text-[9px] uppercase font-bold tracking-wider mb-0.5 font-['Inter']">Resolution Rate</div>
                                                    <div className="text-xl md:text-2xl font-bold font-['Outfit']">94.2%</div>
                                                    <div className="mt-1.5 md:mt-2 h-6 md:h-8 flex items-end gap-0.5">
                                                        {[40, 60, 45, 70, 65, 85, 94].map((h, i) => (
                                                            <div key={i} style={{ height: `${h}%` }} className="flex-1 bg-indigo-400 rounded-t-sm opacity-80" />
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                                                    <div className="bg-white p-2 md:p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                                        <div className="text-slate-500 text-[8px] md:text-[9px] font-['Inter']">Avg Response</div>
                                                        <div className="font-bold text-xs md:text-sm font-['Outfit']">1.2s</div>
                                                    </div>
                                                    <div className="bg-white p-2 md:p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                                        <div className="text-slate-500 text-[8px] md:text-[9px] font-['Inter']">CSAT Score</div>
                                                        <div className="font-bold text-xs md:text-sm text-green-600 font-['Outfit']">4.9/5</div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Screen Footer */}
                                <div className="p-2 md:p-3 bg-white border-t border-slate-100">
                                    <div className={`w-full py-1.5 md:py-2 rounded-md font-bold text-[8px] md:text-[10px] text-center transition-colors duration-300 font-['Inter'] ${activeStep === 3 ? 'bg-green-500 text-white shadow-md shadow-green-200' : 'bg-slate-100 text-slate-400'
                                        }`}>
                                        {activeStep === 3 ? 'Live System Active' : 'Setup in progress...'}
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HowItWorks;
