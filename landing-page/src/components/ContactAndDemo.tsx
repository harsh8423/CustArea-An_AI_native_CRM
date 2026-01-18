'use client';

import { useState, FormEvent, useRef } from 'react';
import emailjs from '@emailjs/browser';

export default function ContactAndDemo() {
    const formRef = useRef<HTMLFormElement>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!formRef.current) return;

        setIsSubmitting(true);
        setError('');

        emailjs.sendForm(
            'service_8s8086x',
            'template_704fefm',
            formRef.current,
            { publicKey: 'L8rZxOe4uIs7h80Gr' }
        )
            .then((result) => {
                console.log('EmailJS Success:', result.text);
                setIsSubmitting(false);
                setSubmitted(true);
                if (formRef.current) formRef.current.reset();
                setTimeout(() => setSubmitted(false), 5000);
            })
            .catch((err) => {
                console.error('EmailJS Error:', err);
                setIsSubmitting(false);
                setError(`Failed to send: ${err.text || 'Please try again'}`);
            });
    };

    const openCalendly = () => {
        window.open('https://calendly.com/harsh857498/30min', '_blank');
    };

    return (
        <section className="py-16 lg:py-24 bg-gray-50 relative overflow-hidden" id="contact">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-12">
                    <span className="badge mb-3">Get In Touch</span>
                    <h2 className="section-heading">
                        Ready to <span className="text-gradient">transform your workflow?</span>
                    </h2>
                </div>

                <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
                    {/* Left: Contact Form */}
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
                        {!submitted ? (
                            <>
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Send us a message</h3>
                                    <p className="text-sm text-gray-500">We'll get back to you within 24 hours.</p>
                                </div>

                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                                        {error}
                                    </div>
                                )}

                                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">First Name *</label>
                                            <input type="text" name="first_name" className="form-input text-sm sm:text-base" placeholder="John" required />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">Last Name *</label>
                                            <input type="text" name="last_name" className="form-input text-sm sm:text-base" placeholder="Doe" required />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">Email *</label>
                                        <input type="email" name="email" className="form-input text-sm sm:text-base" placeholder="john@company.com" required />
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">Company</label>
                                        <input type="text" name="company" className="form-input text-sm sm:text-base" placeholder="Your Company" />
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 block">Message *</label>
                                        <textarea name="message" className="form-input text-sm sm:text-base min-h-[100px] resize-none" placeholder="How can we help?" required />
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn-primary w-full justify-center text-sm sm:text-base"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Sending...' : 'Send Message'}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-3xl">
                                    ✅
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Message Sent!</h3>
                                <p className="text-gray-600 text-sm">We'll be in touch shortly.</p>
                            </div>
                        )}
                    </div>

                    {/* Right: Demo & Info */}
                    <div className="space-y-6">
                        {/* Demo Card */}
                        <div className="bg-gradient-to-br from-[#1E4A8D] to-[#2563eb] p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -mr-10 -mt-10 transition-all duration-700 group-hover:bg-blue-500/30" />

                            <div className="relative z-10">
                                <div className="w-12 h-12 mb-6 rounded-2xl bg-white/10 flex items-center justify-center text-2xl backdrop-blur-sm">
                                    📅
                                </div>
                                <h3 className="text-xl font-bold mb-3">Book a Live Demo</h3>
                                <p className="text-slate-300 text-sm mb-8 leading-relaxed">
                                    See our AI agents in action. We'll show you how to build custom workflows and automate your support in a 30-minute personalized session.
                                </p>
                                <button
                                    onClick={openCalendly}
                                    className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <span>Schedule Demo</span>
                                    <span className="text-lg">→</span>
                                </button>
                                <p className="text-center text-slate-400 text-xs mt-3">No commitment required</p>
                            </div>
                        </div>

                        {/* Quick Contact Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                                    📧
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 font-medium">Email Us</div>
                                    <div className="text-sm font-bold text-gray-900">harsh857498@gmail.com</div>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-lg">
                                    💬
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 font-medium">Live Chat</div>
                                    <div className="text-sm font-bold text-gray-900">Available 24/7</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
