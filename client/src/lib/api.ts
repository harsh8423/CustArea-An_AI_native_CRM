const API_BASE_URL = "http://localhost:8000/api";

interface AuthResponse {
    message?: string;
    token?: string;
    user?: any;
    error?: string;
}

export const api = {
    auth: {
        // ==== MAGIC LINK AUTH ====
        signupWithOTP: async (data: { email: string; companyName: string }): Promise<AuthResponse> => {
            const res = await fetch(`${API_BASE_URL}/v2/auth/signup-with-otp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });
            return res.json();
        },
        getCurrentUser: async (): Promise<any> => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/v2/auth/me`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            return res.json();
        },
        signout: async (): Promise<void> => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            document.cookie = "token=; path=/; max-age=0";
        },

        // ==== LEGACY PASSWORD AUTH (BACKWARD COMPATIBILITY) ====
        register: async (data: any): Promise<AuthResponse> => {
            const res = await fetch(`${API_BASE_URL}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });
            return res.json();
        },
        login: async (data: any): Promise<AuthResponse> => {
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });
            return res.json();
        }
    },
    contacts: {
        list: async (params: any) => {
            const query = new URLSearchParams(params).toString();
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contacts?${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        get: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contacts/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        export: async (params: any) => {
            const query = new URLSearchParams(params).toString();
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contacts/export?${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.blob();
        },
        create: async (data: any) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contacts`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        delete: async (ids: string[]) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contacts`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ ids })
            });
            return res.json();
        },
        update: async (id: string, data: Partial<any>) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contacts/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        updateScore: async (id: string, score: number) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contacts/${id}/score`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ score })
            });
            return res.json();
        },
        getGroups: async (contactId: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contacts/${contactId}/groups`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    contactGroups: {
        list: async (params?: { search?: string; page?: number; limit?: number }) => {
            const token = localStorage.getItem("token");
            const query = params ? new URLSearchParams(params as any).toString() : "";
            const res = await fetch(`${API_BASE_URL}/contact-groups${query ? `?${query}` : ''}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        create: async (data: { name: string; description?: string; color?: string }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contact-groups`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        get: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contact-groups/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        update: async (id: string, data: { name?: string; description?: string; color?: string }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contact-groups/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        delete: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contact-groups/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        addContacts: async (groupId: string, contactIds: string[]) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contact-groups/${groupId}/contacts`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ contactIds })
            });
            return res.json();
        },
        removeContacts: async (groupId: string, contactIds: string[]) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/contact-groups/${groupId}/contacts`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ contactIds })
            });
            return res.json();
        },
        getContacts: async (groupId: string, params?: { page?: number; limit?: number }) => {
            const token = localStorage.getItem("token");
            const query = params ? new URLSearchParams(params as any).toString() : "";
            const res = await fetch(`${API_BASE_URL}/contact-groups/${groupId}/contacts${query ? `?${query}` : ''}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    import: {
        upload: async (file: File) => {
            const formData = new FormData();
            formData.append("file", file);
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/import/upload`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });
            return res.json();
        },
        getJob: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/import/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        map: async (id: string, mappings: any) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/import/${id}/map`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ mappings })
            });
            return res.json();
        },
        process: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/import/${id}/process`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    leads: {
        getPipeline: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/leads/pipeline`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        list: async (params?: { search?: string; stageId?: string; minScore?: number; maxScore?: number }) => {
            const token = localStorage.getItem("token");
            const queryParams = new URLSearchParams();
            if (params?.search) queryParams.append("search", params.search);
            if (params?.stageId) queryParams.append("stageId", params.stageId);
            if (params?.minScore !== undefined) queryParams.append("minScore", String(params.minScore));
            if (params?.maxScore !== undefined) queryParams.append("maxScore", String(params.maxScore));

            const url = `${API_BASE_URL}/leads${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        createFromContacts: async (contactIds: string[]) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/leads`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ contactIds })
            });
            return res.json();
        },
        updateStage: async (id: string, stageId: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/leads/${id}/stage`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ stageId })
            });
            return res.json();
        },
        updateStatus: async (id: string, status: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/leads/${id}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            return res.json();
        },
        updateScore: async (id: string, score: number) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/leads/${id}/score`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ score })
            });
            return res.json();
        }
    },
    email: {
        // SES Identities
        getIdentities: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/email/identities`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        createDomainIdentity: async (domain: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/email/identities/domain`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ domain })
            });
            return res.json();
        },
        checkIdentityStatus: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/email/identities/${id}/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        // Allowed From Emails
        getAllowedFrom: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/email/allowed-from`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        addAllowedFrom: async (email: string, identityId: string, isDefault?: boolean) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/email/allowed-from`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ email, identityId, isDefault })
            });
            return res.json();
        },
        removeAllowedFrom: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/email/allowed-from/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        // Send Email
        sendEmail: async (data: { to: string; subject: string; html?: string; text?: string; fromEmail?: string }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/email/send`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        // Outbound Emails
        getOutboundEmails: async (limit?: number) => {
            const token = localStorage.getItem("token");
            const url = limit ? `${API_BASE_URL}/email/outbound?limit=${limit}` : `${API_BASE_URL}/email/outbound`;
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        // Inbound Emails
        getInboundEmails: async (limit?: number) => {
            const token = localStorage.getItem("token");
            const url = limit ? `${API_BASE_URL}/email/inbound?limit=${limit}` : `${API_BASE_URL}/email/inbound`;
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        // Allowed Inbound Emails
        getAllowedInbound: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/email/allowed-inbound`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        addAllowedInbound: async (email: string, description?: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/email/allowed-inbound`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ email, description })
            });
            return res.json();
        },
        removeAllowedInbound: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/email/allowed-inbound/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    conversations: {
        list: async (params?: { status?: string; channel?: string; assignedTo?: string; search?: string; contactId?: string; limit?: number; offset?: number }) => {
            const token = localStorage.getItem("token");
            const query = params ? new URLSearchParams(params as any).toString() : "";
            const res = await fetch(`${API_BASE_URL}/conversations?${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        get: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversations/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        create: async (data: { contactId?: string; channel: string; channelContactId?: string; subject?: string }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        update: async (id: string, data: { status?: string; priority?: string; assignedTo?: string; aiEnabled?: boolean; ticketId?: string }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversations/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        assign: async (id: string, userId: string | null) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversations/${id}/assign`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ userId })
            });
            return res.json();
        },
        getStats: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversations/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        getMessages: async (conversationId: string, params?: { limit?: number; before?: string; after?: string }) => {
            const token = localStorage.getItem("token");
            const query = params ? new URLSearchParams(params as any).toString() : "";
            const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages?${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        sendMessage: async (conversationId: string, data: { contentText?: string; contentHtml?: string }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        delete: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversations/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    messages: {
        get: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/messages/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        updateStatus: async (id: string, status: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/messages/${id}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            return res.json();
        }
    },
    channels: {
        // WhatsApp
        getWhatsapp: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/channels/whatsapp`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        saveWhatsapp: async (data: { twilioAccountSid: string; twilioAuthToken: string; phoneNumber: string }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/channels/whatsapp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        deleteWhatsapp: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/channels/whatsapp`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        // Widget
        getWidget: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/channels/widget`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        saveWidget: async (data: { allowedDomains?: string[]; theme?: any; welcomeMessage?: string; requireEmail?: boolean }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/channels/widget`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        deleteWidget: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/channels/widget`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        // Phone
        getPhone: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/channels/phone`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        savePhone: async (data: { twilioAccountSid: string; twilioAuthToken: string; phoneNumber: string; voiceModel?: string; transcriptionEnabled?: boolean; recordingEnabled?: boolean }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/channels/phone`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        deletePhone: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/channels/phone`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    tickets: {
        list: async (params?: { status?: string; priority?: string; assignedTo?: string; tagId?: string; search?: string; limit?: number; offset?: number }) => {
            const token = localStorage.getItem("token");
            const query = params ? new URLSearchParams(params as any).toString() : "";
            const res = await fetch(`${API_BASE_URL}/tickets?${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        get: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/tickets/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        create: async (data: { subject: string; description?: string; contactId?: string; sourceConversationId?: string; priority?: string; status?: string; sentiment?: string; intent?: string; summary?: string; tagIds?: string[] }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/tickets`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        update: async (id: string, data: { subject?: string; description?: string; status?: string; priority?: string; assignedTo?: string; sentiment?: string; intent?: string; summary?: string; dueAt?: string }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/tickets/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        delete: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/tickets/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        getStats: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/tickets/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        // Notes
        getNotes: async (ticketId: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/notes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        addNote: async (ticketId: string, data: { content: string; isPinned?: boolean }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/notes`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        updateNote: async (ticketId: string, noteId: string, data: { content?: string; isPinned?: boolean }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/notes/${noteId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        deleteNote: async (ticketId: string, noteId: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/notes/${noteId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        // Activities
        getActivities: async (ticketId: string, limit?: number) => {
            const token = localStorage.getItem("token");
            const query = limit ? `?limit=${limit}` : "";
            const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/activities${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        // Tags
        addTags: async (ticketId: string, tagIds: string[]) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/tags`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ tagIds })
            });
            return res.json();
        },
        removeTag: async (ticketId: string, tagId: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/tags/${tagId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        // Macros
        applyMacro: async (ticketId: string, macroId: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/apply-macro`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ macroId })
            });
            return res.json();
        }
    },
    ticketTags: {
        list: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/ticket-tags`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        create: async (data: { name: string; color?: string; description?: string }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/ticket-tags`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        update: async (id: string, data: { name?: string; color?: string; description?: string }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/ticket-tags/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        delete: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/ticket-tags/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    macros: {
        list: async (activeOnly?: boolean) => {
            const token = localStorage.getItem("token");
            const query = activeOnly !== undefined ? `?activeOnly=${activeOnly}` : "";
            const res = await fetch(`${API_BASE_URL}/macros${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        create: async (data: { name: string; description?: string; macroType?: string; actions?: any[]; scheduleDelayHours?: number }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/macros`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        update: async (id: string, data: { name?: string; description?: string; macroType?: string; actions?: any[]; scheduleDelayHours?: number; isActive?: boolean }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/macros/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        delete: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/macros/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    gmail: {
        authorize: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/settings/email/gmail/authorize`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        getStatus: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/settings/email/gmail/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        disconnect: async (connectionId: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/settings/email/gmail/disconnect/${connectionId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        setDefault: async (connectionId: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/settings/email/gmail/set-default/${connectionId}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    outlook: {
        authorize: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/settings/email/outlook/authorize`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        getStatus: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/settings/email/outlook/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        disconnect: async (connectionId: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/settings/email/outlook/disconnect/${connectionId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        setDefault: async (connectionId: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/settings/email/outlook/set-default/${connectionId}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    features: {
        getAll: async () => {
            const res = await fetch(`${API_BASE_URL}/features`);
            return res.json();
        },
        getTenantFeatures: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/features/tenant`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        enable: async (featureKey: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/features/${featureKey}/enable`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        disable: async (featureKey: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/features/${featureKey}/disable`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    conversationEmail: {
        getSenderAddresses: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversation-email/sender-addresses`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        sendEmail: async (data: {
            from: string;
            to: string;
            subject: string;
            body: string;
            cc?: string;
            bcc?: string;
            conversationId?: string;
        }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversation-email/send-conversation`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        }
    },
    voiceAgents: {
        list: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/voice-agents`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        get: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/voice-agents/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        create: async (data: {
            phoneNumber: string;
            voiceAgentName: string;
            welcomeMessage?: string;
            agentInstructions?: string;
            defaultMethod: 'realtime' | 'legacy';
            sttModelId?: string;
            llmModelId?: string;
            ttsModelId?: string;
            realtimeModelId?: string;
        }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/voice-agents`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        update: async (id: string, data: any) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/voice-agents/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        delete: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/voice-agents/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    phoneNumbers: {
        list: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/phone-numbers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        getAvailable: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/phone-numbers/available`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        getPricing: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/phone-numbers/pricing`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        request: async (data: {
            countryCode: string;
            phoneType: 'local' | 'toll-free';
            notes?: string;
        }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/phone-numbers/request`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        cancel: async (id: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/phone-numbers/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    models: {
        getSTT: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/models/stt`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        getLLM: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/models/llm`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        getTTS: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/models/tts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        getRealtime: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/models/realtime`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },
    conversations: {
        list: async (params: any) => {
            const query = new URLSearchParams(params).toString();
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversations?${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        getMessages: async (conversationId: string, params: any = {}) => {
            const query = new URLSearchParams(params).toString();
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages?${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        delete: async (conversationId: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
                throw new Error('Failed to delete conversation');
            }
            return res.json();
        },
        getStats: async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversations/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        update: async (conversationId: string, data: any) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        sendMessage: async (conversationId: string, data: any) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        }
    },
    bulkEmail: {
        sendBulk: async (data: {
            groupId: string;
            from: string;
            subject: string;
            body: string;
            bodyText?: string;
        }) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/email/send-bulk`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        getJobStatus: async (jobId: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/email/bulk-jobs/${jobId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        listJobs: async (params?: { limit?: number; offset?: number; status?: string }) => {
            const token = localStorage.getItem("token");
            const query = params ? new URLSearchParams(params as any).toString() : "";
            const res = await fetch(`${API_BASE_URL}/email/bulk-jobs${query ? `?${query}` : ''}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        },
        cancelJob: async (jobId: string) => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/email/bulk-jobs/${jobId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.json();
        }
    },

    // ==================== Email History ====================
    emailHistory: {
        // Get outbound email history (single emails)
        getOutbound: async (params?: {
            limit?: number;
            offset?: number;
            status?: string;
            startDate?: string;
            endDate?: string;
            search?: string;
        }) => {
            const queryParams = new URLSearchParams();
            if (params?.limit) queryParams.append('limit', params.limit.toString());
            if (params?.offset) queryParams.append('offset', params.offset.toString());
            if (params?.status) queryParams.append('status', params.status);
            if (params?.startDate) queryParams.append('startDate', params.startDate);
            if (params?.endDate) queryParams.append('endDate', params.endDate);
            if (params?.search) queryParams.append('search', params.search);

            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/email/history/outbound?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
            });
            if (!response.ok) throw new Error('Failed to fetch outbound history');
            return response.json();
        },

        // Get outbound email details
        getOutboundDetails: async (emailId: string) => {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/email/history/outbound/${emailId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
            });
            if (!response.ok) throw new Error('Failed to fetch email details');
            return response.json();
        },

        // Get bulk job history
        getBulkJobs: async (params?: {
            limit?: number;
            offset?: number;
            status?: string;
            startDate?: string;
            endDate?: string;
        }) => {
            const queryParams = new URLSearchParams();
            if (params?.limit) queryParams.append('limit', params.limit.toString());
            if (params?.offset) queryParams.append('offset', params.offset.toString());
            if (params?.status) queryParams.append('status', params.status);
            if (params?.startDate) queryParams.append('startDate', params.startDate);
            if (params?.endDate) queryParams.append('endDate', params.endDate);

            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/email/history/bulk?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
            });
            if (!response.ok) throw new Error('Failed to fetch bulk job history');
            return response.json();
        }
    },

    // Bulk Phone Calling
    bulkPhoneCall: {
        async start(data: {
            groupId: string;
            callerPhoneNumber: string;
            callMode?: 'ai' | 'human';
            customInstruction?: string;
        }) {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/phone/bulk-call`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start bulk call');
            }

            return response.json();
        },

        async getStatus(jobId: string) {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/phone/bulk-jobs/${jobId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to get job status');
            }

            return response.json();
        },

        async list(params?: {
            limit?: number;
            offset?: number;
            status?: string;
        }) {
            const token = localStorage.getItem('token');
            const queryParams = new URLSearchParams(params as any).toString();
            const url = `${API_BASE_URL}/phone/bulk-jobs${queryParams ? `?${queryParams}` : ''}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to list jobs');
            }

            return response.json();
        },

        async pause(jobId: string) {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/phone/bulk-jobs/${jobId}/pause`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to pause job');
            }

            return response.json();
        },

        async resume(jobId: string) {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/phone/bulk-jobs/${jobId}/resume`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to resume job');
            }

            return response.json();
        },

        async cancel(jobId: string) {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/phone/bulk-jobs/${jobId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to cancel job');
            }

            return response.json();
        }
    }
};
