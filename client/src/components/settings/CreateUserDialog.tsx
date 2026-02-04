"use client";

import { useState, useEffect } from "react";
import { rbacApi } from "@/lib/rbacApi";
import { X, Loader2 } from "lucide-react";

interface CreateUserDialogProps {
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateUserDialog({ onClose, onSuccess }: CreateUserDialogProps) {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
    });
    const [roles, setRoles] = useState<any[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingRoles, setLoadingRoles] = useState(true);

    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const response = await rbacApi.roles.list();
                setRoles(response.roles || []);
            } catch (error) {
                console.error("Failed to fetch roles", error);
            } finally {
                setLoadingRoles(false);
            }
        };
        fetchRoles();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.password) {
            alert("Please fill in all fields");
            return;
        }

        try {
            setLoading(true);
            // We need to add create method to rbacApi definition or use raw fetch if not available yet
            // Assuming rbacApi.users.create exists or we will add it.
            // If not, we can use fetch directly here for speed or update rbacApi file.
            // Let's assume we'll update rbacApi file next.
            await rbacApi.users.create({
                ...formData,
                roleIds: selectedRoles,
            });

            alert("User created successfully");
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Failed to create user:", error);
            alert(error.message || "Failed to create user");
        } finally {
            setLoading(false);
        }
    };

    const toggleRole = (roleId: string) => {
        setSelectedRoles((prev) =>
            prev.includes(roleId)
                ? prev.filter((id) => id !== roleId)
                : [...prev, roleId]
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">Create New User</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData({ ...formData, name: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="John Doe"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) =>
                                setFormData({ ...formData, email: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="john@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) =>
                                setFormData({ ...formData, password: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Assign Roles
                        </label>
                        {loadingRoles ? (
                            <div className="text-center py-4 text-gray-500 text-sm">
                                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                                Loading roles...
                            </div>
                        ) : (
                            <div className="max-h-40 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                                {roles.map((role) => (
                                    <label
                                        key={role.id}
                                        className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedRoles.includes(role.id)}
                                            onChange={() => toggleRole(role.id)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                                        />
                                        <span className="text-sm text-gray-700">
                                            {role.display_name}
                                        </span>
                                    </label>
                                ))}
                                {roles.length === 0 && (
                                    <p className="text-sm text-gray-500 text-center py-2">
                                        No roles found
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {loading ? "Creating..." : "Create User"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
