import { Trash2, Download, X, UserPlus, Users, UserCheck } from "lucide-react";

interface BulkActionsProps {
    selectedCount: number;
    onClearSelection: () => void;
    onDelete: () => void;
    onExport: () => void;
    onAddToLeads?: () => void;
    onAddToGroup?: () => void;
    onAssignToUser?: () => void;
}

export function BulkActions({ selectedCount, onClearSelection, onDelete, onExport, onAddToLeads, onAddToGroup, onAssignToUser }: BulkActionsProps) {
    if (selectedCount === 0) return null;

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2 pr-4 border-r border-gray-700">
                <span className="font-medium text-sm">{selectedCount} selected</span>
                <button onClick={onClearSelection} className="hover:text-gray-300">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="flex items-center gap-1 pl-2">
                {onAddToLeads && (
                    <button
                        onClick={onAddToLeads}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-full transition text-sm font-medium"
                        title="Add to Leads"
                    >
                        <UserPlus className="h-4 w-4" />
                        Add to Leads
                    </button>
                )}
                {onAddToGroup && (
                    <button
                        onClick={onAddToGroup}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-full transition text-sm font-medium"
                        title="Add to Group"
                    >
                        <Users className="h-4 w-4" />
                        Add to Group
                    </button>
                )}
                {onAssignToUser && (
                    <button
                        onClick={onAssignToUser}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full transition text-sm font-medium"
                        title="Assign to User"
                    >
                        <UserCheck className="h-4 w-4" />
                        Assign
                    </button>
                )}
                <button
                    onClick={onExport}
                    className="p-2 hover:bg-gray-800 rounded-full transition tooltip"
                    title="Export Selected"
                >
                    <Download className="h-4 w-4" />
                </button>
                <button
                    onClick={onDelete}
                    className="p-2 hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded-full transition"
                    title="Delete Selected"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
