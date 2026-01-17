'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function UnifiedPlatform() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });

    // --- Animation Sequence ---
    // 0.00 - 0.25: Header 1 In
    // 0.25 - 0.50: Header 2 In
    // 0.50 - 0.75: Header 3 In
    // 0.75 - 1.00: All Headers Hold

    // Header 1: "One platform."
    const h1Opacity = useTransform(scrollYProgress, [0.05, 0.20, 0.75, 0.95], [0, 1, 1, 0]);
    const h1Y = useTransform(scrollYProgress, [0.05, 0.20, 0.75, 0.95], [20, 0, 0, -50]);

    // Header 2: "One context."
    const h2Opacity = useTransform(scrollYProgress, [0.30, 0.45, 0.75, 0.95], [0, 1, 1, 0]);
    const h2Y = useTransform(scrollYProgress, [0.30, 0.45, 0.75, 0.95], [20, 0, 0, -50]);

    // Header 3: "One decision engine."
    const h3Opacity = useTransform(scrollYProgress, [0.55, 0.70, 0.75, 0.95], [0, 1, 1, 0]);
    const h3Y = useTransform(scrollYProgress, [0.55, 0.70, 0.75, 0.95], [20, 0, 0, -50]);



    return (
        <section ref={containerRef} className="relative h-[250vh] bg-white z-20">
            <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden">

                {/* Background Gradients */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_70%)]" />
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full h-full flex flex-col items-center justify-center">

                    {/* Headers Container - Absolute to overlap with content if needed, but we use sequence */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="space-y-4 md:space-y-6">
                            <motion.h2
                                style={{ opacity: h1Opacity, y: h1Y }}
                                className="text-5xl md:text-7xl lg:text-8xl font-bold text-slate-900 tracking-tight"
                            >
                                One platform.
                            </motion.h2>
                            <motion.h2
                                style={{ opacity: h2Opacity, y: h2Y }}
                                className="text-5xl md:text-7xl lg:text-8xl font-bold text-slate-900 tracking-tight"
                            >
                                One context.
                            </motion.h2>
                            <motion.h2
                                style={{ opacity: h3Opacity, y: h3Y }}
                                className="text-5xl md:text-7xl lg:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-amber-500 tracking-tight pb-2"
                            >
                                One decision engine.
                            </motion.h2>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
