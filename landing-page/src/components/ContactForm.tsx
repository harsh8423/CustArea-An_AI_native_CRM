'use client';

import { useState, FormEvent, useRef } from 'react';
import emailjs from '@emailjs/browser';

export default function ContactForm() {
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

    const contacts = [
        { icon: '📧', label: 'Email', value: 'harsh857498@gmail.com' },
        { icon: '💬', label: 'Live Chat', value: 'Available 24/7' },
        { icon: '📍', label: 'Location', value: 'India' },
    ];

    return (
        <section className="py-24 lg:py-32 bg-gray-50" id="contact">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
                    {/* Left Content */}
                    <div>
                        <span className="badge-gold mb-4">Get In Touch</span>
                        <h2 className="section-heading mb-6">
                            Have questions? <span className="text-gradient-gold">Let's talk</span>
                        </h2>
                        <p className="text-lg text-gray-600 mb-10 leading-relaxed">
                            Our team is here to help. Whether you have questions about features,
                            pricing, or implementation — we'd love to hear from you.
                        </p>

                        <div className="space-y-6">
                            {contacts.map((contact, i) => (
                                <div key={i} className="flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-2xl">
                                        {contact.icon}
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-500">{contact.label}</div>
                                        <div className="font-semibold text-gray-900">{contact.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Form */}
                    <div className="card">
                        {!submitted ? (
                            <>
                                <h3 className="text-2xl font-bold text-gray-900 mb-6">Send us a message</h3>

                                {error && (
                                    <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                                        {error}
                                    </div>
                                )}

                                <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">First Name *</label>
                                            <input type="text" name="first_name" className="form-input" placeholder="John" required />
                                        </div>
                                        <div>
                                            <label className="form-label">Last Name *</label>
                                            <input type="text" name="last_name" className="form-input" placeholder="Doe" required />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="form-label">Email *</label>
                                        <input type="email" name="email" className="form-input" placeholder="john@company.com" required />
                                    </div>

                                    <div>
                                        <label className="form-label">Company</label>
                                        <input type="text" name="company" className="form-input" placeholder="Your Company" />
                                    </div>

                                    <div>
                                        <label className="form-label">Message *</label>
                                        <textarea name="message" className="form-input min-h-[140px] resize-none" placeholder="How can we help?" required />
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn-primary w-full justify-center text-lg"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Sending...' : 'Send Message'}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div className="text-center py-10">
                                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500 flex items-center justify-center text-4xl">
                                    ✅
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-3">Thank You! 🎉</h3>
                                <p className="text-gray-600">We'll get back to you within 24 hours!</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
