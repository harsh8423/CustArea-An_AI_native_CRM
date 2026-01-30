/**
 * Copilot API Client
 * Frontend API wrapper for Copilot endpoints
 */

const API_BASE_URL = "http://localhost:8000/api";

const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
};

export interface CopilotChatRequest {
    conversationId: string;
    query: string;
    contactId?: string;
}

export interface CopilotChatResponse {
    success: boolean;
    response: string;
    context: {
        channelType: string;
        messageCount: number;
        hasKnowledge: boolean;
    };
}

export interface GenerateReplyRequest {
    conversationId: string;
    instructions?: string;
    tone?: 'professional' | 'friendly' | 'formal' | 'empathetic';
    contactId?: string;
}

export interface GenerateReplyResponse {
    success: boolean;
    draft: string;
    channel: string;
    tone: string;
    metadata: {
        generatedAt: string;
    };
}

export interface SummarizeRequest {
    conversationId: string;
    summaryType?: 'brief' | 'detailed' | 'action_items';
    contactId?: string;
}

export interface SummarizeResponse {
    success: boolean;
    summary: string;
    summaryType: string;
    messageCount: number;
    metadata: {
        generatedAt: string;
    };
}

export interface CrossChannelSearchParams {
    contactId?: string;
    email?: string;
    phone?: string;
    channels?: string[];
    limit?: number;
}

export interface CrossChannelSearchResponse {
    success: boolean;
    conversations: any[];
    groupedByChannel: Record<string, any[]>;
    totalCount: number;
    channels: string[];
}

export interface CopilotSession {
    id: string;
    conversationId: string;
    sessionStartedAt: string;
    queriesCount: number;
    repliesGeneratedCount: number;
    summariesRequestedCount: number;
}

export interface CopilotMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface SessionResponse {
    success: boolean;
    session: CopilotSession | null;
    messages: CopilotMessage[];
}

export interface QuickAction {
    id: string;
    label: string;
    icon: string;
    description: string;
}

export interface QuickActionsResponse {
    success: boolean;
    quickActions: QuickAction[];
    context: {
        channel: string;
        messageCount: number;
    };
}

const copilotApi = {
    /**
     * Send a chat message to Copilot
     */
    async chat(data: CopilotChatRequest): Promise<CopilotChatResponse> {
        const response = await fetch(`${API_BASE_URL}/ai-agent/copilot/chat`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return response.json();
    },

    /**
     * Generate a reply draft for the conversation
     */
    async generateReply(data: GenerateReplyRequest): Promise<GenerateReplyResponse> {
        const response = await fetch(`${API_BASE_URL}/ai-agent/copilot/generate-reply`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return response.json();
    },

    /**
     * Summarize a conversation
     */
    async summarize(data: SummarizeRequest): Promise<SummarizeResponse> {
        const response = await fetch(`${API_BASE_URL}/ai-agent/copilot/summarize`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return response.json();
    },

    /**
     * Search for conversations across all channels
     */
    async crossChannelSearch(params: CrossChannelSearchParams): Promise<CrossChannelSearchResponse> {
        const query = new URLSearchParams(params as any).toString();
        const response = await fetch(`${API_BASE_URL}/ai-agent/copilot/cross-channel-search?${query}`, {
            headers: getAuthHeaders(),
        });
        return response.json();
    },

    /**
     * Get Copilot session history for a conversation
     */
    async getSession(conversationId: string): Promise<SessionResponse> {
        const response = await fetch(`${API_BASE_URL}/ai-agent/copilot/session/${conversationId}`, {
            headers: getAuthHeaders(),
        });
        return response.json();
    },

    /**
     * End the current Copilot session
     */
    async endSession(conversationId: string): Promise<{ success: boolean; message: string }> {
        const response = await fetch(`${API_BASE_URL}/ai-agent/copilot/session/${conversationId}/end`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        return response.json();
    },

    /**
     * Get contextual quick action suggestions
     */
    async getQuickActions(conversationId: string): Promise<QuickActionsResponse> {
        const response = await fetch(`${API_BASE_URL}/ai-agent/copilot/quick-actions?conversationId=${conversationId}`, {
            headers: getAuthHeaders(),
        });
        return response.json();
    }
};

export default copilotApi;
