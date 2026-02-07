
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { X, Check, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserData {
    id: string;
    email: string;
    name: string;
    role: string;
}

interface AssignLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadId: string;
    onSuccess?: () => void;
}

export default function AssignLeadModal({ isOpen, onClose, leadId, onSuccess }: AssignLeadModalProps) {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isAssigning, setIsAssigning] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            setSelectedUserId(null); // Reset selection
        }
    }, [isOpen]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await api.users.list();
            setUsers(data.users || []); // Assuming response is { users: [] }
        } catch (error) {
            console.error('Failed to fetch users', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedUserId || !leadId) return;

        try {
            setIsAssigning(true);
            await api.leads.assign(leadId, selectedUserId);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to assign lead', error);
            alert('Failed to assign lead');
        } finally {
            setIsAssigning(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.name?.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Assign Lead</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-100">
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading users...</div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No users found</div>
                    ) : (
                        filteredUsers.map(user => (
                            <button
                                key={user.id}
                                onClick={() => setSelectedUserId(user.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                                    selectedUserId === user.id ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent"
                                )}
                            >
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                                    <User className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 truncate">{user.name}</div>
                                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                                </div>
                                {selectedUserId === user.id && (
                                    <Check className="w-5 h-5 text-blue-600" />
                                )}
                            </button>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                    <Button variant="outline" onClick={onClose} disabled={isAssigning}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAssign}
                        disabled={!selectedUserId || isAssigning}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isAssigning ? "Assigning..." : "Assign User"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
