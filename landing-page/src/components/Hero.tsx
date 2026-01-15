'use client';

import { useState, useRef } from 'react';

export default function Hero() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoError, setVideoError] = useState(false);

    const handlePlayClick = () => {
        if (videoRef.current) {
            videoRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(() => setVideoError(true));
        }
    };

    return (
        <section className="relative min-h-screen flex flex-col justify-center overflow-hidden py-32 lg:py-40" id="hero">
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#EBF2FA] via-white to-[#FBF6E8]">
                {/* Animated Orbs */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] rounded-full bg-gradient-to-br from-[#1E4A8D]/20 to-[#1E4A8D]/10 blur-3xl animate-float opacity-60" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] lg:w-[700px] lg:h-[700px] rounded-full bg-gradient-to-br from-[#D4AF37]/30 to-[#D4AF37]/20 blur-3xl animate-float-delayed opacity-60" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-[#1E4A8D]/15 to-[#D4AF37]/10 blur-3xl animate-float-delayed-2 opacity-40" />

                {/* Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-4xl mx-auto">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/80 backdrop-blur-sm border border-blue-100 rounded-full shadow-lg shadow-blue-100/50 mb-8">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-semibold text-gray-700">AI-Powered Customer Platform</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-6">
                        Customer relationships,
                        <br />
                        <span className="text-gradient">reimagined with AI</span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 leading-relaxed max-w-2xl mx-auto mb-10">
                        Unite WhatsApp, Email, Phone & Chat in one intelligent platform.
                        Automate workflows visually. Deploy AI that truly understands.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                        <a href="#demo" className="btn-primary text-lg py-5 px-10">
                            Start Free Trial
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </a>
                        <a href="#video" className="btn-outline text-lg py-5 px-10">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                            Watch Demo
                        </a>
                    </div>

                    {/* Stats Row */}
                    <div className="flex flex-wrap justify-center gap-8 lg:gap-16 mb-16">
                        {[
                            { value: '10K+', label: 'Active Users' },
                            { value: '50M+', label: 'Messages Processed' },
                            { value: '99.9%', label: 'Uptime' },
                            { value: '24/7', label: 'AI Support' },
                        ].map((stat, i) => (
                            <div key={i} className="text-center">
                                <div className="text-2xl lg:text-3xl font-bold text-gray-900">{stat.value}</div>
                                <div className="text-sm text-gray-500">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Video Section */}
                <div id="video" className="max-w-5xl mx-auto">
                    <div className="relative bg-white rounded-3xl p-2 sm:p-3 shadow-2xl shadow-gray-300/50">
                        {/* Browser Chrome */}
                        <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 rounded-t-2xl">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-400" />
                                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                <div className="w-3 h-3 rounded-full bg-green-400" />
                            </div>
                            <div className="flex-1 mx-4">
                                <div className="bg-white rounded-lg px-4 py-1.5 text-xs text-gray-400 text-center">
                                    app.custarea.com
                                </div>
                            </div>
                        </div>

                        {/* Video Container */}
                        <div className="relative aspect-video bg-gradient-to-br from-blue-900 to-gray-900 rounded-b-2xl overflow-hidden">
                            {videoError ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8">
                                    <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
                                        <svg className="w-10 h-10 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Demo Video</h3>
                                    <p className="text-gray-400 text-center text-sm max-w-md">
                                        Add your video file to <code className="bg-white/10 px-2 py-1 rounded">public/intro-video.mp4</code>
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <video
                                        ref={videoRef}
                                        className="w-full h-full object-cover"
                                        src="/intro-video.mp4"
                                        poster="/video-poster.jpg"
                                        playsInline
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onEnded={() => setIsPlaying(false)}
                                        onError={() => setVideoError(true)}
                                        controls={isPlaying}
                                    />
                                    {!isPlaying && (
                                        <button
                                            onClick={handlePlayClick}
                                            className="absolute inset-0 flex items-center justify-center group"
                                        >
                                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 flex items-center justify-center shadow-2xl shadow-amber-500/50 group-hover:scale-110 transition-transform duration-300">
                                                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            </div>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
