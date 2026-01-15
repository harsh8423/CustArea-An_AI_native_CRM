'use client';

export default function DemoSection() {
    const benefits = [
        'Personalized platform walkthrough',
        'See AI agents in action',
        'Live workflow builder demo',
        'Custom pricing for your needs',
        'Q&A with our product experts'
    ];

    const openCalendly = () => {
        window.open('https://calendly.com/harsh857498/30min', '_blank');
    };

    return (
        <section className="py-24 lg:py-32" id="demo">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                    {/* Left Content */}
                    <div>
                        <span className="badge mb-4">Schedule Demo</span>
                        <h2 className="section-heading mb-6">
                            See CustArea <span className="text-gradient-gold">in action</span>
                        </h2>
                        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                            Book a personalized demo with our team. We'll show you exactly how CustArea
                            can transform your customer relationships and automate your workflows.
                        </p>

                        <ul className="space-y-4 mb-10">
                            {benefits.map((benefit, index) => (
                                <li key={index} className="flex items-center gap-4 text-gray-700">
                                    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </span>
                                    {benefit}
                                </li>
                            ))}
                        </ul>

                        {/* Trust */}
                        <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-2xl">
                            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
                                ⏱️
                            </div>
                            <div>
                                <div className="font-bold text-gray-900">30-Minute Demo</div>
                                <div className="text-sm text-gray-500">No commitment required</div>
                            </div>
                        </div>
                    </div>

                    {/* Right - Book Call Card */}
                    <div className="card text-center">
                        <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-5xl shadow-xl shadow-blue-500/30">
                            📅
                        </div>

                        <h3 className="text-2xl font-bold text-gray-900 mb-4">Schedule a Call</h3>

                        <p className="text-gray-600 mb-8 leading-relaxed">
                            Book a free consultation call with our team to discuss your project in detail.
                            No sales pitch, just real solutions.
                        </p>

                        <button
                            onClick={openCalendly}
                            className="btn-primary w-full justify-center text-lg mb-4"
                        >
                            📞 Book Free Call
                        </button>

                        <p className="text-sm text-gray-500">Opens Calendly in a new tab</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
