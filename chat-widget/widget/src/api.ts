// Configurable backend URL
const BACKEND_URL = (window as any).__WIDGET_BACKEND_URL__ || 'http://localhost:8000';

let currentToken: string | null = null;
let currentSessionId: string | null = null;

async function initSession(siteId: string, anonId: string): Promise<{ token: string; sessionId: string }> {
    const res = await fetch(`${BACKEND_URL}/api/widget/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, anonId }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Init failed' }));
        throw new Error(error.error || 'Init failed');
    }

    const data = await res.json();
    currentToken = data.token;
    currentSessionId = data.sessionId;
    return { token: data.token, sessionId: data.sessionId };
}

async function ensureToken(siteId: string, anonId: string): Promise<string> {
    if (currentToken) return currentToken;
    const { token } = await initSession(siteId, anonId);
    return token;
}

export interface SendMessageOptions {
    email?: string;
    phone?: string;
    name?: string;
    metadata?: Record<string, any>;
}

export interface ChatResponse {
    conversationId: string;
    reply: string;
    aiEnabled: boolean;
}

export async function sendMessage(
    siteId: string,
    anonId: string,
    message: string,
    conversationId?: string,
    options: SendMessageOptions = {}
): Promise<ChatResponse> {
    const token = await ensureToken(siteId, anonId);

    const body: Record<string, any> = {
        message,
        conversationId,
        metadata: {
            pageUrl: window.location.href,
            userAgent: navigator.userAgent,
            ...(options.metadata || {}),
        },
    };

    // Include contact info if provided
    if (options.email) body.email = options.email;
    if (options.phone) body.phone = options.phone;
    if (options.name) body.name = options.name;

    const res = await fetch(`${BACKEND_URL}/api/widget/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });

    if (res.status === 401 || res.status === 403) {
        // Token invalid/expired: re-init once
        currentToken = null;
        const { token: newToken } = await initSession(siteId, anonId);

        const retryRes = await fetch(`${BACKEND_URL}/api/widget/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${newToken}`,
            },
            body: JSON.stringify(body),
        });

        if (!retryRes.ok) throw new Error("Chat failed after retry");
        return retryRes.json();
    }

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Chat failed' }));
        throw new Error(error.error || 'Chat failed');
    }

    return res.json();
}

export async function getHistory(siteId: string, anonId: string, conversationId: string) {
    const token = await ensureToken(siteId, anonId);

    const res = await fetch(`${BACKEND_URL}/api/widget/history?conversationId=${conversationId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) throw new Error("Failed to fetch history");
    return res.json();
}

export function getSessionId(): string | null {
    return currentSessionId;
}

export function setBackendUrl(url: string) {
    (window as any).__WIDGET_BACKEND_URL__ = url;
}
