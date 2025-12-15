"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FilterBar } from "@/components/contacts/FilterBar";
import { ContactTable, Column, Contact } from "@/components/contacts/ContactTable";
import { ImportWizard } from "@/components/contacts/ImportWizard";
import { AddContactModal } from "@/components/contacts/AddContactModal";
import { BulkActions } from "@/components/contacts/BulkActions";
import { FilterModal } from "@/components/contacts/FilterModal";
import { api } from "@/lib/api";

import { User, Mail, Phone, Building, Tag, Clock, MapPin, LayoutGrid } from "lucide-react";

const DEFAULT_COLUMNS: Column[] = [
    { id: "name", label: "Full Name", accessor: "name", visible: true, width: "200px", icon: <User className="h-3.5 w-3.5" /> },
    { id: "email", label: "Email", accessor: "email", visible: true, width: "220px", icon: <Mail className="h-3.5 w-3.5" /> },
    { id: "location", label: "Location", accessor: "metadata.location", visible: true, width: "150px", icon: <MapPin className="h-3.5 w-3.5" /> },
    { id: "company", label: "Company", accessor: "company_name", visible: true, width: "150px", icon: <Building className="h-3.5 w-3.5" /> },
    { id: "segments", label: "Segments", accessor: "metadata.segments", visible: true, width: "150px", icon: <Tag className="h-3.5 w-3.5" /> },
    { id: "created_at", label: "Last Active", accessor: "created_at", visible: true, width: "120px", icon: <Clock className="h-3.5 w-3.5" /> },
];

export default function ContactsPage() {
    const router = useRouter();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isAddContactOpen, setIsAddContactOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Spreadsheet State
    const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const fetchContacts = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.contacts.list({ page, search, limit: 100 });
            setContacts(data.contacts);
            setTotalPages(data.totalPages);

            // Detect custom columns from metadata
            if (data.contacts.length > 0) {
                const customKeys = new Set<string>();
                data.contacts.forEach((c: Contact) => {
                    if (c.metadata) {
                        Object.keys(c.metadata).forEach(k => customKeys.add(k));
                    }
                });

                // Filter out system keys like 'score' from being added as visible columns
                const systemKeys = ["score", "location", "segments"];

                setColumns(prev => {
                    const existingIds = new Set(prev.map(c => c.id));
                    const newCols = Array.from(customKeys)
                        .filter(k => !existingIds.has(k) && !systemKeys.includes(k))
                        .map(k => ({
                            id: k,
                            label: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '),
                            accessor: `metadata.${k}`,
                            visible: true,
                            width: "150px"
                        }));
                    return [...prev, ...newCols];
                });
            }
        } catch (err) {
            console.error("Failed to fetch contacts", err);
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchContacts();
        }, 300);
        return () => clearTimeout(debounce);
    }, [fetchContacts]);

    // Selection Handlers
    const handleToggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleToggleSelectAll = () => {
        if (selectedIds.size === contacts.length && contacts.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(contacts.map(c => c.id)));
        }
    };

    const handleToggleColumn = (id: string) => {
        setColumns(prev => prev.map(col =>
            col.id === id ? { ...col, visible: !col.visible } : col
        ));
    };

    const handleExport = async () => {
        try {
            const blob = await api.contacts.export({ search });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "contacts.csv";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export failed", err);
            alert("Export failed");
        }
    };

    const handleDelete = async () => {
        if (selectedIds.size === 0) return;

        const confirmed = window.confirm(`Are you sure you want to delete ${selectedIds.size} contact(s)?`);
        if (!confirmed) return;

        try {
            await api.contacts.delete(Array.from(selectedIds));
            setSelectedIds(new Set());
            fetchContacts();
        } catch (err) {
            console.error("Delete failed", err);
            alert("Delete failed");
        }
    };

    const handleApplyFilters = (filters: any[]) => {
        // For now, we'll just log the filters
        // A full implementation would update the query params
        console.log("Applying filters:", filters);
        // TODO: Implement backend filtering with these conditions
    };

    return (
        <div className="h-full flex flex-col bg-[#eff0eb]">
            <div className="flex-1 bg-white rounded-tl-3xl rounded-br-2xl mt-4 mr-4 mb-4 overflow-hidden flex flex-col shadow-[0px_1px_4px_0px_rgba(20,20,20,0.15)] relative">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                    <div className="flex items-center gap-6">
                        <h1 className="text-xl font-bold text-gray-900">Leads</h1>
                        <div className="flex items-center bg-gray-100/80 p-1 rounded-xl">
                            <button className="px-4 py-2 text-sm font-medium bg-white text-gray-900 rounded-lg shadow-sm transition-all duration-200">
                                Contacts
                            </button>
                            <button
                                onClick={() => router.push("/sales/leads")}
                                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-lg transition-all duration-200"
                            >
                                Leads
                            </button>
                            <button
                                onClick={() => router.push("/sales/lead-board")}
                                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-lg transition-all duration-200 flex items-center gap-1.5"
                            >
                                <LayoutGrid className="h-4 w-4" />
                                Board
                            </button>
                        </div>
                    </div>
                    <div className="text-sm text-gray-500">Manage your customer relationships</div>
                </div>

                <FilterBar
                    onSearch={setSearch}
                    onExport={handleExport}
                    onImport={() => setIsImportOpen(true)}
                    onAddContact={() => setIsAddContactOpen(true)}
                    onFilter={() => setIsFilterOpen(true)}
                    columns={columns}
                    onToggleColumn={handleToggleColumn}
                />

                <ContactTable
                    contacts={contacts}
                    columns={columns}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    loading={loading}
                    onRefresh={fetchContacts}
                />

                <BulkActions
                    selectedCount={selectedIds.size}
                    onClearSelection={() => setSelectedIds(new Set())}
                    onDelete={handleDelete}
                    onExport={handleExport}
                    onAddToLeads={async () => {
                        if (selectedIds.size === 0) return;
                        try {
                            const result = await api.leads.createFromContacts(Array.from(selectedIds));
                            alert(`Added ${result.leads?.length || 0} contacts to leads. ${result.skipped > 0 ? `(${result.skipped} already existed)` : ''}`);
                            setSelectedIds(new Set());
                        } catch (err) {
                            console.error("Failed to add to leads", err);
                            alert("Failed to add to leads");
                        }
                    }}
                />

                <ImportWizard
                    isOpen={isImportOpen}
                    onClose={() => setIsImportOpen(false)}
                    onComplete={() => {
                        setIsImportOpen(false);
                        fetchContacts();
                    }}
                />

                <AddContactModal
                    isOpen={isAddContactOpen}
                    onClose={() => setIsAddContactOpen(false)}
                    onSuccess={() => {
                        fetchContacts();
                    }}
                />

                <FilterModal
                    isOpen={isFilterOpen}
                    onClose={() => setIsFilterOpen(false)}
                    onApply={handleApplyFilters}
                    availableFields={columns.map(c => ({ id: c.id, label: c.label }))}
                />
            </div>
        </div>
    );
}
