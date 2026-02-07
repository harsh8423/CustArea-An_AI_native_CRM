
import { CheckCircle, AlertCircle, Clock, Globe, MessageCircle, Mail, Phone } from 'lucide-react';

interface SystemStatusProps {
    deployments: {
        channel: string;
        enabled: boolean;
        schedule?: { start: string; end: string; days: string[] };
    }[];
}

export default function SystemStatus({ deployments }: SystemStatusProps) {
    const channels = ['widget', 'whatsapp', 'email', 'phone'];

    // Helper to get icon
    const getIcon = (channel: string) => {
        switch (channel) {
            case 'widget': return Globe;
            case 'whatsapp': return MessageCircle;
            case 'email': return Mail;
            case 'phone': return Phone;
            default: return Globe;
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm h-full">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                System Status
            </h2>

            <div className="space-y-3">
                {channels.map(channel => {
                    const deployment = deployments.find(d => d.channel === channel);
                    const isEnabled = deployment?.enabled || channel === 'widget'; // Widget usually always active if embedded
                    const Icon = getIcon(channel);

                    return (
                        <div key={channel} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium capitalize text-gray-900">{channel}</p>
                                    <p className="text-xs text-gray-500">
                                        {isEnabled ? 'Operational' : 'Disabled'}
                                    </p>
                                </div>
                            </div>

                            {isEnabled ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                                <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
