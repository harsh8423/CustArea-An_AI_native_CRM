import Link from 'next/link';
import { UserPlus, Target, Megaphone, Ticket, Plus } from 'lucide-react';

export default function QuickActions() {
    const actions = [
        {
            label: 'Add Contact',
            href: '/sales/contacts?action=new',
            icon: UserPlus,
            color: 'text-blue-600',
            bg: 'bg-blue-50 hover:bg-blue-100'
        },
        {
            label: 'New Lead',
            href: '/sales/leads?action=new',
            icon: Target,
            color: 'text-orange-600',
            bg: 'bg-orange-50 hover:bg-orange-100'
        },
        {
            label: 'Create Campaign',
            href: '/campaign/new',
            icon: Megaphone,
            color: 'text-pink-600',
            bg: 'bg-pink-50 hover:bg-pink-100'
        },
        {
            label: 'New Ticket',
            href: '/tickets?action=new',
            icon: Ticket,
            color: 'text-purple-600',
            bg: 'bg-purple-50 hover:bg-purple-100'
        }
    ];

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm h-full">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-4">
                {actions.map((action, i) => (
                    <Link
                        key={i}
                        href={action.href}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200 ${action.bg} group`}
                    >
                        <div className={`w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                            <action.icon className={`w-5 h-5 ${action.color}`} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{action.label}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
