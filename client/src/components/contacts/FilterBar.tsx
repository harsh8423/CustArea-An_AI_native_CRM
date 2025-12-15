import { Search, Download, Upload, Plus, SlidersHorizontal, Columns } from "lucide-react";
import { Column } from "./ContactTable";

interface FilterBarProps {
    onSearch: (term: string) => void;
    onExport: () => void;
    onImport: () => void;
    onAddContact: () => void;
    onFilter: () => void;
    columns: Column[];
    onToggleColumn: (id: string) => void;
}

export function FilterBar({ onSearch, onExport, onImport, onAddContact, onFilter, columns, onToggleColumn }: FilterBarProps) {
    return (
        <div className="flex items-center justify-between gap-4 p-3 bg-white border-b border-gray-200">
            {/* Left: Search & Filters */}
            <div className="flex items-center gap-2 flex-1">
                <div className="relative w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black/5 bg-gray-50 focus:bg-white transition"
                        onChange={(e) => onSearch(e.target.value)}
                    />
                </div>

                <div className="h-6 w-px bg-gray-200 mx-1" />

                {/* Column Toggle Dropdown (Simple implementation for now) */}
                <div className="relative group">
                    <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition">
                        <Columns className="h-4 w-4" />
                        Columns
                    </button>
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-50 p-2">
                        <div className="text-xs font-semibold text-gray-500 mb-2 px-2">Visible Columns</div>
                        {columns.map(col => (
                            <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={col.visible}
                                    onChange={() => onToggleColumn(col.id)}
                                    className="rounded border-gray-300 text-black focus:ring-black/5"
                                />
                                <span className="text-sm text-gray-700">{col.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <button
                    onClick={onFilter}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition"
                >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filter
                </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onImport}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
                >
                    <Upload className="h-4 w-4" />
                    Import
                </button>
                <button
                    onClick={onAddContact}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-800 transition shadow-sm"
                >
                    <Plus className="h-4 w-4" />
                    Add Contact
                </button>
            </div>
        </div>
    );
}
