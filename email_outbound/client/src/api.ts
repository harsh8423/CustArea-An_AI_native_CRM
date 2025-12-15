const API_BASE = '/tenants';

// Helper to get tenantId (for demo purposes we can hardcode or ask user)
// For this demo, let's assume a hardcoded tenantId or generate one.
export const getTenantId = () => {
    let id = localStorage.getItem('tenantId');
    if (!id) {
        // We need a valid UUID. For now, let's ask the user to create one via UI or just use a placeholder if the backend supports it.
        // But our backend expects a UUID in the URL.
        // We'll handle this in the UI.
        return '';
    }
    return id;
};

export const setTenantId = (id: string) => {
    localStorage.setItem('tenantId', id);
};

export const createTenant = async (name: string) => {
    const res = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    return res.json();
};

export const createDomainIdentity = async (tenantId: string, domain: string) => {
    const res = await fetch(`${API_BASE}/${tenantId}/ses/identities/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
    });
    return res.json();
};
export const checkIdentityStatus = async (tenantId: string, domain: string) => {
    const res = await fetch(`${API_BASE}/${tenantId}/ses/identities/domain/${domain}/status`);
    return res.json();
};

export const getAllowedEmails = async (tenantId: string, domain?: string) => {
    let url = `${API_BASE}/${tenantId}/ses/allowed-from`;
    if (domain) {
        url += `?domain=${encodeURIComponent(domain)}`;
    }
    const res = await fetch(url);
    return res.json();
};

export const addAllowedFrom = async (tenantId: string, domain: string, fromEmail: string) => {
    const res = await fetch(`${API_BASE}/${tenantId}/ses/allowed-from`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, fromEmail }),
    });
    return res.json();
};

export const sendEmail = async (tenantId: string, data: any) => {
    const res = await fetch(`${API_BASE}/${tenantId}/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return res.json();
};
