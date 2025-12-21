'use client';

import { useState, useEffect } from 'react';
import {
    FileText, Bot, Calendar, Mail, MessageCircle, BarChart3,
    PieChart, TrendingUp, Clock, Sparkles, Plus, Check,
    Settings, Send, ArrowRight
} from 'lucide-react';

export default function ReportPage() {
    const [activeReport, setActiveReport] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveReport(prev => (prev + 1) % 3);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const sampleReports = [
        {
            name: 'Daily Sales Summary',
            frequency: 'Daily at 9:00 AM',
            delivery: 'Email',
            icon: TrendingUp,
            fields: ['New leads', 'Conversions', 'Revenue']
        },
        {
            name: 'Weekly Support Metrics',
            frequency: 'Every Monday',
            delivery: 'WhatsApp',
            icon: BarChart3,
            fields: ['Ticket volume', 'Resolution time', 'CSAT']
        },
        {
            name: 'Monthly Performance',
            frequency: '1st of month',
            delivery: 'Email',
            icon: PieChart,
            fields: ['Team stats', 'Campaign ROI', 'Growth trends']
        }
    ];

    return (
        <div className="h-full flex flex-col bg-[#eff0eb]">
            <div className="flex-1 bg-white rounded-tl-3xl rounded-br-2xl mt-4 mr-4 mb-4 overflow-hidden flex flex-col shadow-[0px_1px_4px_0px_rgba(20,20,20,0.15)]">
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-5xl mx-auto p-8">
                        {/* Header */}
                        <div className="text-center mb-12">
                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-full mb-6">
                                <Sparkles className="w-4 h-4" />
                                Coming Soon
                            </span>
                            <h1 className="text-4xl font-bold text-black mb-4">AI-Powered Reports</h1>
                            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                                Create customized reports with AI assistance. Get daily, weekly, or monthly insights
                                delivered directly to your WhatsApp or email.
                            </p>
                        </div>

                        {/* Report Builder Visual */}
                        <div className="bg-white rounded-3xl border border-gray-200 p-8 mb-12 shadow-sm">
                            <h2 className="text-lg font-semibold text-black mb-8 text-center">Create Custom Reports</h2>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Report Builder Mock */}
                                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                                            <Plus className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-black">Report Builder</h3>
                                            <p className="text-xs text-gray-500">Drag & drop fields</p>
                                        </div>
                                    </div>

                                    {/* Field Selection */}
                                    <div className="space-y-3 mb-6">
                                        <div className="text-xs text-gray-400 uppercase mb-2">Selected Fields</div>
                                        {['Total Contacts', 'New Leads This Period', 'Conversation Volume', 'Ticket Resolution Rate'].map((field, i) => (
                                            <div key={i} className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200">
                                                <span className="text-sm text-black">{field}</span>
                                                <Check className="w-4 h-4 text-green-500" />
                                            </div>
                                        ))}
                                    </div>

                                    {/* AI Assist */}
                                    <div className="bg-black rounded-xl p-4 text-white">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Bot className="w-4 h-4" />
                                            <span className="text-sm font-medium">AI Assistant</span>
                                        </div>
                                        <p className="text-xs text-gray-400">
                                            "Add executive summary with key insights and recommendations?"
                                        </p>
                                    </div>
                                </div>

                                {/* Schedule & Delivery Mock */}
                                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                                            <Settings className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-black">Schedule & Deliver</h3>
                                            <p className="text-xs text-gray-500">Automated delivery options</p>
                                        </div>
                                    </div>

                                    {/* Frequency Options */}
                                    <div className="mb-6">
                                        <div className="text-xs text-gray-400 uppercase mb-3">Frequency</div>
                                        <div className="flex gap-2">
                                            <FrequencyButton label="Daily" active />
                                            <FrequencyButton label="Weekly" />
                                            <FrequencyButton label="Monthly" />
                                        </div>
                                    </div>

                                    {/* Time Selection */}
                                    <div className="mb-6">
                                        <div className="text-xs text-gray-400 uppercase mb-3">Delivery Time</div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-black">9:00 AM IST</span>
                                        </div>
                                    </div>

                                    {/* Delivery Channel */}
                                    <div>
                                        <div className="text-xs text-gray-400 uppercase mb-3">Deliver Via</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-white rounded-lg p-3 border-2 border-black flex items-center gap-3">
                                                <Mail className="w-4 h-4 text-black" />
                                                <span className="text-sm font-medium text-black">Email</span>
                                            </div>
                                            <div className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                                                <MessageCircle className="w-4 h-4 text-gray-400" />
                                                <span className="text-sm text-gray-500">WhatsApp</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sample Reports */}
                        <div className="mb-12">
                            <h2 className="text-lg font-semibold text-black mb-6 text-center">Your Reports</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {sampleReports.map((report, i) => (
                                    <div
                                        key={i}
                                        className={`bg-white rounded-2xl border-2 p-6 transition-all duration-500 ${activeReport === i
                                            ? 'border-black shadow-lg scale-105'
                                            : 'border-gray-200'
                                            }`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${activeReport === i ? 'bg-black' : 'bg-gray-100'
                                            }`}>
                                            <report.icon className={`w-6 h-6 ${activeReport === i ? 'text-white' : 'text-gray-500'
                                                }`} />
                                        </div>
                                        <h3 className="font-semibold text-black mb-2">{report.name}</h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                                            <Calendar className="w-3 h-3" />
                                            {report.frequency}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                                            {report.delivery === 'Email' ? (
                                                <Mail className="w-3 h-3" />
                                            ) : (
                                                <MessageCircle className="w-3 h-3" />
                                            )}
                                            Via {report.delivery}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {report.fields.map((field, j) => (
                                                <span key={j} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                                                    {field}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Features */}
                        <div className="bg-black rounded-3xl p-8 text-white">
                            <h2 className="text-xl font-semibold mb-6 text-center">Key Features</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <FeatureItem
                                    icon={Bot}
                                    title="AI-Generated Insights"
                                    description="Smart summaries and recommendations"
                                />
                                <FeatureItem
                                    icon={Settings}
                                    title="Full Customization"
                                    description="Choose exactly what data to include"
                                />
                                <FeatureItem
                                    icon={Calendar}
                                    title="Flexible Scheduling"
                                    description="Daily, weekly, or monthly delivery"
                                />
                                <FeatureItem
                                    icon={Send}
                                    title="Multi-Channel Delivery"
                                    description="Email or WhatsApp, your choice"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FrequencyButton({ label, active = false }: { label: string; active?: boolean }) {
    return (
        <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active
            ? 'bg-black text-white'
            : 'bg-white text-gray-500 border border-gray-200'
            }`}>
            {label}
        </button>
    );
}

function FeatureItem({ icon: Icon, title, description }: {
    icon: any;
    title: string;
    description: string;
}) {
    return (
        <div className="bg-white/10 rounded-xl p-4">
            <Icon className="w-5 h-5 text-white mb-2" />
            <h3 className="font-medium text-white mb-1">{title}</h3>
            <p className="text-sm text-gray-400">{description}</p>
        </div>
    );
}
