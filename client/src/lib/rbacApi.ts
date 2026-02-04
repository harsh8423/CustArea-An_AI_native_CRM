const API_BASE_URL = "http://localhost:8000/api";

const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    };
};

// ========== RBAC API ==========

export const rbacApi = {
    // Permissions
    permissions: {
        list: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/permissions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        getMyPermissions: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/permissions/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },

    // Roles
    roles: {
        list: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/roles`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        get: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/roles/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        create: async (data: {
            role_name: string;
            description?: string;
        }) => {
            const res = await fetch(`${API_BASE_URL}/roles`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to create role');
            }
            return res.json();
        },
        update: async (id: string, data: {
            role_name?: string;
            description?: string;
        }) => {
            const res = await fetch(`${API_BASE_URL}/roles/${id}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to update role');
            }
            return res.json();
        },
        delete: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/roles/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        assignPermissions: async (id: string, permissionIds: string[]) => {
            const res = await fetch(`${API_BASE_URL}/roles/${id}/permissions`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ permissionIds })
            });
            return res.json();
        }
    },

    // Users
    users: {
        list: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        get: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        create: async (data: {
            email: string;
            name: string;
            password?: string;
            roleIds?: string[];
            permissionOverrides?: Record<string, boolean>;
            assignedLeadIds?: string[];
            assignedContactIds?: string[];
        }) => {
            const res = await fetch(`${API_BASE_URL}/users/create`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });
            return res.json();
        },
        invite: async (data: {
            email: string;
            roleIds?: string[];
            permissionOverrides?: Record<string, boolean>;
            assignedLeadIds?: string[];
            assignedContactIds?: string[];
            inboundEmailIds?: string[];
            outboundEmailConfigs?: Array<{
                email_type: 'connection' | 'identity';
                email_connection_id?: string;
                ses_identity_id?: string;
                allowed_from_email_id?: string;
            }>;
            phoneConfigIds?: string[];
            whatsappAccountIds?: string[];
        }) => {
            const res = await fetch(`${API_BASE_URL}/users/invite`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });
            return res.json();
        },
        update: async (id: string, data: {
            name?: string;
            status?: string;
        }) => {
            const res = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });
            return res.json();
        },
        deactivate: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        assignRoles: async (id: string, roleIds: string[]) => {
            const res = await fetch(`${API_BASE_URL}/users/${id}/assign-roles`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ roleIds })
            });
            return res.json();
        },
        grantPermissions: async (id: string, permissions: Record<string, boolean>) => {
            const res = await fetch(`${API_BASE_URL}/users/${id}/grant-permissions`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ permissions })
            });
            return res.json();
        },
        assignLeads: async (id: string, leadIds: string[]) => {
            const res = await fetch(`${API_BASE_URL}/users/${id}/assign-leads`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ leadIds })
            });
            return res.json();
        },
        assignContacts: async (id: string, contactIds: string[]) => {
            const res = await fetch(`${API_BASE_URL}/users/${id}/assign-contacts`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ contactIds })
            });
            return res.json();
        },
        grantChannelAccess: async (id: string, data: {
            inboundEmailIds?: string[];
            outboundEmailConfigs?: Array<{
                email_type: 'connection' | 'identity';
                email_connection_id?: string;
                ses_identity_id?: string;
                allowed_from_email_id?: string;
            }>;
            phoneConfigIds?: string[];
            whatsappAccountIds?: string[];
        }) => {
            const res = await fetch(`${API_BASE_URL}/users/${id}/grant-channel-access`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });
            return res.json();
        },
        assignContactGroups: async (id: string, groupIds: string[]) => {
            const res = await fetch(`${API_BASE_URL}/users/${id}/assign-contact-groups`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ groupIds })
            });
            return res.json();
        },
        getContactGroups: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/users/${id}/contact-groups`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },

    // Conversations
    conversations: {
        forward: async (conversationId: string, toUserId: string, note?: string) => {
            const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/forward`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ toUserId, note })
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to forward conversation');
            }
            return res.json();
        }
    },

    // Channels - For fetching available channel options
    channels: {
        getInboundEmails: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/channels/inbound-emails`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        getOutboundEmails: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/channels/outbound-emails`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        getPhones: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/channels/phones`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    }
};
