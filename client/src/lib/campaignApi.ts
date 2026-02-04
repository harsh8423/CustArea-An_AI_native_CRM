import { api as baseApi } from './api';

const API_BASE_URL = "http://localhost:8000/api";

interface Campaign {
    id: string;
    tenant_id: string;
    name: string;
    status: string;
    contact_group_id: string;
    company_name: string;
    website_url?: string;
    campaign_objective: string;
    selling_points: string;
    pain_points: string;
    value_proposition: string;
    proof_points?: string;
    reply_handling: 'human' | 'ai';
    ai_instructions?: string;
    language: string;
    daily_send_limit: number;
    max_contacts_limit: number;
    created_at: string;
    launched_at?: string;
}

interface CampaignTemplate {
    id: string;
    campaign_id: string;
    template_type: 'initial' | 'follow_up';
    subject: string;
    body_html: string;
    body_text: string;
    personalization_fields: any;
    is_ai_generated: boolean;
}

interface CampaignAnalytics {
    campaign_id: string;
    total_enrolled: number;
    emails_sent: number;
    emails_sent_today: number;
    bounced: number;
    replied: number;
    skipped_no_email: number;
    pending: number;
    completed: number;
}

export const campaignApi = {
    // Campaign CRUD
    async list(params?: { status?: string; search?: string; offset?: number; limit?: number }) {
        const token = localStorage.getItem("token");
        const query = params ? new URLSearchParams(params as any).toString() : "";
        const res = await fetch(`${API_BASE_URL}/campaigns${query ? `?${query}` : ''}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.json();
    },

    async get(id: string) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.json();
    },

    async create(data: Partial<Campaign>) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async update(id: string, data: Partial<Campaign>) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async delete(id: string) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.json();
    },

    // Campaign lifecycle
    async launch(id: string) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}/launch`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.json();
    },

    async pause(id: string) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}/pause`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.json();
    },

    async resume(id: string) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}/resume`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.json();
    },

    // Templates
    async generateTemplates(id: string, followUpCount: number = 2) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}/templates/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ followUpCount })
        });
        return res.json();
    },

    async getTemplates(id: string) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}/templates`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.json();
    },

    async createTemplate(id: string, data: { template_type: string; subject: string; body_html: string; wait_period_value?: number; wait_period_unit?: string }) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}/templates`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to create template');
        }
        return res.json();
    },

    async updateTemplate(id: string, templateId: string, data: { subject: string; body_html: string; wait_period_value?: number; wait_period_unit?: string }) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}/templates/${templateId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to update template');
        }
        return res.json();
    },

    async deleteTemplate(id: string, templateId: string) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}/templates/${templateId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to delete template');
        }
        return res.json();
    },

    // Email rotation
    async setEmailRotation(id: string, emailConnections: Array<{ id: string, type: string }>) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}/emails/rotation`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ emailConnections })
        });
        return res.json();
    },

    async getEmailRotation(id: string) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}/emails/rotation`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.json();
    },

    // Analytics
    async getAnalytics(id: string) {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}/analytics`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.json();
    },

    async getContacts(id: string, params?: { limit?: number; offset?: number; search?: string }) {
        const token = localStorage.getItem("token");
        const query = params ? new URLSearchParams(params as any).toString() : "";
        const res = await fetch(`${API_BASE_URL}/campaigns/${id}/contacts${query ? `?${query}` : ''}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.json();
    },
};

