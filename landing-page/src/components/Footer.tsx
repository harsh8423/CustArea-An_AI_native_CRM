export default function Footer() {
    const links = {
        product: ['Features', 'How It Works', 'AI Agents', 'Workflows', 'Integrations'],
        resources: ['Documentation', 'API Reference', 'Blog', 'Help Center'],
        company: ['About Us', 'Careers', 'Contact', 'Privacy Policy']
    };

    return (
        <footer className="bg-gray-900 text-gray-400 pt-20 pb-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <img src="/logo.png" alt="CustArea" className="w-10 h-10 object-contain" />
                            <span className="text-xl font-bold">
                                <span className="text-[#A8C5E8]">Cust</span>
                                <span className="text-[#D4AF37]">Area</span>
                            </span>
                        </div>
                        <p className="text-sm leading-relaxed mb-6">
                            The AI-native customer relationship platform that unifies communications
                            and automates engagement across every channel.
                        </p>
                        <div className="flex gap-3">
                            {['𝕏', 'in', 'f'].map((icon, i) => (
                                <a key={i} href="#" className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-[#D4AF37] hover:text-gray-900 transition-colors">
                                    {icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Product */}
                    <div>
                        <h4 className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wider mb-6">Product</h4>
                        <ul className="space-y-3">
                            {links.product.map((link, i) => (
                                <li key={i}>
                                    <a href="#" className="text-sm hover:text-white transition-colors">{link}</a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wider mb-6">Resources</h4>
                        <ul className="space-y-3">
                            {links.resources.map((link, i) => (
                                <li key={i}>
                                    <a href="#" className="text-sm hover:text-white transition-colors">{link}</a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h4 className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wider mb-6">Company</h4>
                        <ul className="space-y-3">
                            {links.company.map((link, i) => (
                                <li key={i}>
                                    <a href="#" className="text-sm hover:text-white transition-colors">{link}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom */}
                <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-sm">© {new Date().getFullYear()} CustArea. All rights reserved.</p>
                    <div className="flex gap-6 text-sm">
                        <a href="#" className="hover:text-white transition-colors">Privacy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms</a>
                        <a href="#" className="hover:text-white transition-colors">Cookies</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
