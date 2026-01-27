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
        list: async (params?: { status?: string; channel?: string; assignedTo?: string; search?: string; limit?: number; offset?: number }) => {
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
    }
};
