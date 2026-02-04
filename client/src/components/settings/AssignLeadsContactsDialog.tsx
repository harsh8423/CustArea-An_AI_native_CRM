"use client";

import { useState, useEffect } from 'react';
import { rbacApi } from '@/lib/rbacApi';
import { api } from '@/lib/api';

interface AssignLeadsContactsDialogProps {
    userId: string;
    type: 'leads' | 'contacts';
    currentAssignments: Array<{ id: string; name?: string; contact_name?: string }>;
    onClose: () => void;
    onSuccess: () => void;
}

interface Lead {
    id: string;
    contact_name: string;
    status: string;
}

interface Contact {
    id: string;
    name: string;
    email: string;
}

export function AssignLeadsContactsDialog({ userId, type, currentAssignments, onClose, onSuccess }: AssignLeadsContactsDialogProps) {
    const [availableItems, setAvailableItems] = useState<(Lead | Contact)[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>(currentAssignments.map(a => a.id));
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchItems();
    }, [type]);

    const fetchItems = async () => {
        try {
            setLoading(true);
            if (type === 'leads') {
                const data = await api.leads.list();
                setAvailableItems(data.leads || []);
            } else {
                const data = await api.contacts.list({});
                setAvailableItems(data.contacts || []);
            }
        } catch (err) {
            console.error(`Failed to fetch ${type}:`, err);
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = (itemId: string) => {
        if (selectedIds.includes(itemId)) {
            setSelectedIds(selectedIds.filter(id => id !== itemId));
        } else {
            setSelectedIds([...selectedIds, itemId]);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            if (type === 'leads') {
                await rbacApi.users.assignLeads(userId, selectedIds);
            } else {
                await rbacApi.users.assignContacts(userId, selectedIds);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(`Failed to assign ${type}:`, err);
            alert(`Failed to assign ${type}: ${err.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const filteredItems = availableItems.filter(item => {
        if (!searchQuery) return true;
        const searchLower = searchQuery.toLowerCase();
        if (type === 'leads') {
            return (item as Lead).contact_name?.toLowerCase().includes(searchLower);
        } else {
            const contact = item as Contact;
            return contact.name?.toLowerCase().includes(searchLower) ||
                contact.email?.toLowerCase().includes(searchLower);
        }
    });

    const getItemName = (item: Lead | Contact) => {
        if (type === 'leads') {
            return (item as Lead).contact_name;
        }
        return (item as Contact).name;
    };

    const getItemSubtext = (item: Lead | Contact) => {
        if (type === 'leads') {
            return `Status: ${(item as Lead).status}`;
        }
        return (item as Contact).email;
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
                        <p className="text-sm text-gray-600">Loading {type}...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Assign {type === 'leads' ? 'Leads' : 'Contacts'}
                </h2>

                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${type}...`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                <div className="flex-1 overflow-y-auto space-y-2 mb-6">
                    {filteredItems.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-8">
                            No {type} found
                        </p>
                    ) : (
                        filteredItems.map(item => (
                            <label
                                key={item.id}
                                className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(item.id)}
                                    onChange={() => toggleItem(item.id)}
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="ml-3 flex-1">
                                    <div className="font-medium text-gray-900">{getItemName(item)}</div>
                                    <p className="text-sm text-gray-500">{getItemSubtext(item)}</p>
                                </div>
                            </label>
                        ))
                    )}
                </div>

                <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-3">
                        Selected: {selectedIds.length} {type}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={saving}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Saving...
                                </>
                            ) : (
                                'Save Assignments'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
