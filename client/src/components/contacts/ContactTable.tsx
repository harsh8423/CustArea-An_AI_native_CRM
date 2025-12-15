import { MoreHorizontal, Star, MapPin, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export interface Contact {
    id: string;
    name: string;
    email: string;
    phone: string;
    company_name: string;
    source: string;
    created_at: string;
    score?: number;
    metadata?: Record<string, any>;
    [key: string]: any;
}

export interface Column {
    id: string;
    label: string;
    accessor: string;
    width?: string;
    visible: boolean;
    icon?: React.ReactNode;
}

interface ContactTableProps {
    contacts: Contact[];
    columns: Column[];
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onToggleSelectAll: () => void;
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    loading: boolean;
    onRefresh?: () => void;
}

const getInitials = (name: string) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const getAvatarColor = (name: string) => {
    const colors = [
        "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500",
        "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-red-500"
    ];
    const hash = name ? name.charCodeAt(0) + (name.charCodeAt(1) || 0) : 0;
    return colors[hash % colors.length];
};

export function ContactTable({
    contacts,
    columns,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    page,
    totalPages,
    onPageChange,
    loading,
    onRefresh
}: ContactTableProps) {
    const router = useRouter();
    const visibleColumns = columns.filter(c => c.visible);
    const allSelected = contacts.length > 0 && contacts.every(c => selectedIds.has(c.id));

    const getValue = (obj: any, path: string) => {
        return path.split('.').reduce((o, k) => (o || {})[k], obj);
    };

    const handleScoreClick = async (contactId: string, score: number) => {
        try {
            await api.contacts.updateScore(contactId, score);
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error("Failed to update score", err);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Loading data...
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex-1 overflow-x-auto relative">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="sticky top-0 z-20 bg-white border-b border-gray-100">
                        <tr>
                            <th className="w-10 px-4 py-3 bg-white sticky left-0 z-30">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={onToggleSelectAll}
                                    className="rounded border-gray-300 text-blue-500 focus:ring-blue-500/20"
                                />
                            </th>

                            {visibleColumns.map((col) => (
                                <th
                                    key={col.id}
                                    className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider bg-white whitespace-nowrap"
                                    style={{ width: col.width }}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {col.icon}
                                        {col.label}
                                    </div>
                                </th>
                            ))}

                            <th className="w-24 px-4 py-3 bg-white"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {contacts.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.length + 3} className="px-6 py-16 text-center text-gray-400 text-sm">
                                    No records found. Import data to get started.
                                </td>
                            </tr>
                        ) : (
                            contacts.map((contact, idx) => {
                                const isSelected = selectedIds.has(contact.id);
                                const currentScore = contact.score || 0;

                                return (
                                    <tr
                                        key={contact.id}
                                        className={cn(
                                            "group border-b border-gray-50 transition-colors hover:bg-gray-50/50",
                                            isSelected && "bg-blue-50/50",
                                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                                        )}
                                    >
                                        <td className="px-4 py-3 sticky left-0 z-10 bg-inherit">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => onToggleSelect(contact.id)}
                                                className="rounded border-gray-300 text-blue-500 focus:ring-blue-500/20"
                                            />
                                        </td>

                                        {visibleColumns.map((col) => {
                                            const value = getValue(contact, col.accessor);

                                            if (col.id === 'name') {
                                                return (
                                                    <td key={col.id} className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium",
                                                                getAvatarColor(value || "")
                                                            )}>
                                                                {getInitials(value || "")}
                                                            </div>
                                                            <span className="text-sm font-medium text-gray-900">{value || "-"}</span>
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            if (col.id === 'location' && value) {
                                                return (
                                                    <td key={col.id} className="px-4 py-3">
                                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                                            <MapPin className="h-4 w-4 text-red-400" />
                                                            {value}
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            if (col.id === 'segments' && value) {
                                                const tags = Array.isArray(value) ? value : [value];
                                                return (
                                                    <td key={col.id} className="px-4 py-3">
                                                        <div className="flex flex-wrap gap-1">
                                                            {tags.length > 0 ? tags.map((tag: string, i: number) => (
                                                                <span key={i} className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                                                                    {tag}
                                                                </span>
                                                            )) : <span className="text-gray-300 text-sm">No segments</span>}
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td
                                                    key={col.id}
                                                    className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis max-w-[250px]"
                                                >
                                                    {col.id === 'created_at'
                                                        ? (value ? new Date(value).toLocaleDateString() : "-")
                                                        : value || <span className="text-gray-300">Unknown</span>
                                                    }
                                                </td>
                                            );
                                        })}

                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => router.push(`/sales/contacts/${contact.id}`)}
                                                className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-pink-500 to-orange-400 rounded-md hover:opacity-90 transition flex items-center gap-1.5"
                                            >
                                                <Eye className="h-3 w-3" />
                                                Preview
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
