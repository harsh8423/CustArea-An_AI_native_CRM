import { Zap, Phone, Mail, MessageSquare } from 'lucide-react';

export default function UsageWidget() {
    return (
        <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl p-6 shadow-sm text-white h-full relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-xl"></div>

            <h2 className="font-semibold text-white mb-6 flex items-center gap-2 relative z-10">
                <Zap className="w-4 h-4 text-yellow-400" /> Plan Usage
            </h2>

            <div className="space-y-5 relative z-10">
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-300">Credits Remaining</span>
                        <span className="font-medium">850 / 1,000</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 w-[85%]"></div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2">
                    <div className="text-center">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-2">
                            <Phone className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-xs text-gray-400">Voice</p>
                        <p className="text-sm font-semibold">120m</p>
                    </div>
                    <div className="text-center">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-2">
                            <Mail className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-xs text-gray-400">Email</p>
                        <p className="text-sm font-semibold">540</p>
                    </div>
                    <div className="text-center">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-2">
                            <MessageSquare className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-xs text-gray-400">Chat</p>
                        <p className="text-sm font-semibold">2,100</p>
                    </div>
                </div>

                <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors border border-white/10">
                    Upgrade Plan
                </button>
            </div>
        </div>
    );
}
