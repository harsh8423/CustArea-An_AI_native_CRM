let currentToken: string | null = null;

async function initSession(siteId: string, anonId: string): Promise<string> {
    const res = await fetch("http://localhost:4000/widget/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, anonId }),
    });
    if (!res.ok) throw new Error("Init failed");
    const data = await res.json();
    currentToken = data.token;
    return data.token;
}

async function ensureToken(siteId: string, anonId: string): Promise<string> {
    if (currentToken) return currentToken;
    return initSession(siteId, anonId);
}

export async function sendMessage(
    siteId: string,
    anonId: string,
    message: string,
    conversationId?: string,
    metadata: Record<string, any> = {}
) {
    const token = await ensureToken(siteId, anonId);
    const res = await fetch("http://localhost:4000/widget/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            message,
            conversationId,
            metadata: {
                pageUrl: window.location.href,
                userAgent: navigator.userAgent,
                ...metadata,
            },
        }),
    });

    if (res.status === 401 || res.status === 403) {
        // token invalid/expired: re-init once
        currentToken = null;
        const newToken = await initSession(siteId, anonId);
        const retryRes = await fetch("http://localhost:4000/widget/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${newToken}`,
            },
            body: JSON.stringify({ message, conversationId, metadata }),
        });
        return retryRes.json();
    }

    if (!res.ok) throw new Error("Chat failed");
    return res.json();
}
