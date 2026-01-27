import React from "react";
import { X, Filter as FilterIcon, Mail, MessageCircle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    filters: {
        channel: 'all' | 'email' | 'whatsapp' | 'widget';
        mailbox: string | null;
        status: string | null;
    };
    onApplyFilters: (filters: { channel: 'all' | 'email' | 'whatsapp' | 'widget'; mailbox: string | null; status: string | null }) => void;
    mailboxes: Array<{ id: string; email: string; description?: string }>;
}

export function FilterModal({ isOpen, onClose, filters, onApplyFilters, mailboxes }: FilterModalProps) {
    const [localFilters, setLocalFilters] = React.useState(filters);

    React.useEffect(() => {
        setLocalFilters(filters);
    }, [filters]);

    if (!isOpen) return null;

    const channelOptions = [
        { value: 'all' as const, label: 'All Channels', icon: FilterIcon },
        { value: 'email' as const, label: 'Email', icon: Mail },
        { value: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
        { value: 'widget' as const, label: 'Widget', icon: MessageSquare },
    ];

    const statusOptions = [
        { value: null, label: 'All Statuses' },
        { value: 'open', label: 'Open' },
        { value: 'pending', label: 'Pending' },
        { value: 'resolved', label: 'Resolved' },
    ];

    const handleClear = () => {
        setLocalFilters({ channel: 'all', mailbox: null, status: null });
    };

    const handleApply = () => {
        onApplyFilters(localFilters);
        onClose();
    };

    const activeFilterCount =
        (localFilters.channel !== 'all' ? 1 : 0) +
        (localFilters.mailbox ? 1 : 0) +
        (localFilters.status ? 1 : 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                <FilterIcon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Filter Conversations</h3>
                                {activeFilterCount > 0 && (
                                    <p className="text-xs text-gray-500">{activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    {/* Channel Filter */}
                    <div>
                        <label className="text-sm font-semibold text-gray-900 mb-3 block">
                            Channel Type
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {channelOptions.map((option) => {
                                const Icon = option.icon;
                                const isSelected = localFilters.channel === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setLocalFilters({ ...localFilters, channel: option.value, mailbox: option.value !== 'email' ? null : localFilters.mailbox })}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                                            isSelected
                                                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm"
                                                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span>{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Mailbox Filter - Only show if Email is selected */}
                    {localFilters.channel === 'email' && (
                        <div>
                            <label className="text-sm font-semibold text-gray-900 mb-3 block">
                                Mailbox
                            </label>
                            {mailboxes.length > 0 ? (
                                <>
                                    <select
                                        value={localFilters.mailbox || ''}
                                        onChange={(e) => setLocalFilters({ ...localFilters, mailbox: e.target.value || null })}
                                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                                    >
                                        <option value="">All Mailboxes</option>
                                        {mailboxes.map((mailbox) => (
                                            <option key={mailbox.id} value={mailbox.email}>
                                                {mailbox.email}
                                                {mailbox.description && ` - ${mailbox.description}`}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-400 mt-2">
                                        Filter conversations by specific email inbox
                                    </p>
                                </>
                            ) : (
                                <div className="px-4 py-3 text-sm bg-gray-50 text-gray-500 rounded-xl">
                                    No mailboxes configured. Add inbound email addresses in settings.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status Filter */}
                    <div>
                        <label className="text-sm font-semibold text-gray-900 mb-3 block">
                            Conversation Status
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {statusOptions.map((option) => {
                                const isSelected = localFilters.status === option.value;
                                return (
                                    <button
                                        key={option.value || 'all'}
                                        onClick={() => setLocalFilters({ ...localFilters, status: option.value })}
                                        className={cn(
                                            "px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                                            isSelected
                                                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm"
                                                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                    <button
                        onClick={handleClear}
                        className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-white rounded-xl transition-all duration-200"
                    >
                        Clear Filters
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-white rounded-xl transition-all duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium text-sm hover:opacity-90 transition-all duration-200 shadow-sm shadow-blue-500/20"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
