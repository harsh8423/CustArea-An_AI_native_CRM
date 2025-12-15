import { useState, useEffect } from 'react';
import { createTenant, createDomainIdentity, checkIdentityStatus, addAllowedFrom, sendEmail, getTenantId, setTenantId, getAllowedEmails } from './api';
import './index.css';

function App() {
    const [tenantId, setLocalTenantId] = useState(getTenantId());
    const [tenantName, setTenantName] = useState('');

    const [domain, setDomain] = useState('');
    const [identityData, setIdentityData] = useState<any>(null);
    const [dnsRecords, setDnsRecords] = useState<any>(null);

    const [fromEmail, setFromEmail] = useState('');
    const [allowedEmails, setAllowedEmails] = useState<any[]>([]);

    const [emailTo, setEmailTo] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [selectedFromEmail, setSelectedFromEmail] = useState('');
    const [sendResult, setSendResult] = useState<any>(null);

    useEffect(() => {
        if (tenantId) {
            fetchAllowedEmails();
        }
    }, [tenantId]);

    const fetchAllowedEmails = async () => {
        if (!tenantId) return;
        try {
            const res = await getAllowedEmails(tenantId);
            if (res.allowedEmails) {
                setAllowedEmails(res.allowedEmails);
                if (res.allowedEmails.length > 0) {
                    setSelectedFromEmail(res.allowedEmails[0].email_address);
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleCreateTenant = async () => {
        if (!tenantName) return;
        try {
            const res = await createTenant(tenantName);
            if (res.error) {
                alert(`Error: ${res.error}`);
                return;
            }
            if (res.id) {
                setTenantId(res.id);
                setLocalTenantId(res.id);
            }
        } catch (e: any) {
            console.error(e);
            alert('Failed to create tenant: ' + e.message);
        }
    };

    const handleConnectDomain = async () => {
        if (!domain || !tenantId) return;
        try {
            const res = await createDomainIdentity(tenantId, domain);
            if (res.error) {
                alert(`Error: ${res.error}`);
                return;
            }
            setIdentityData(res.identity);
            setDnsRecords(res.dnsRecords);
        } catch (e: any) {
            console.error(e);
            alert('Failed to connect domain: ' + e.message);
        }
    };

    const handleCheckStatus = async () => {
        if (!domain || !tenantId) return;
        try {
            const res = await checkIdentityStatus(tenantId, domain);
            if (res.error) {
                alert(`Error: ${res.error}`);
                return;
            }
            setIdentityData(res.identity);
            // Update local status if needed
        } catch (e: any) {
            console.error(e);
            alert('Failed to check status: ' + e.message);
        }
    };

    const handleAddFrom = async () => {
        if (!fromEmail || !domain || !tenantId) {
            alert("Please enter a domain and an email address.");
            return;
        }
        try {
            const res = await addAllowedFrom(tenantId, domain, fromEmail);
            if (res.error) {
                alert(`Error: ${res.error}`);
                return;
            }
            if (res.allowedFrom) {
                const newList = [res.allowedFrom, ...allowedEmails];
                setAllowedEmails(newList);
                setFromEmail('');
                if (!selectedFromEmail) {
                    setSelectedFromEmail(res.allowedFrom.email_address);
                }
            }
        } catch (e: any) {
            console.error(e);
            alert('Failed to add from email: ' + e.message);
        }
    };

    const handleSendEmail = async () => {
        if (!tenantId) return;
        try {
            const res = await sendEmail(tenantId, {
                to: emailTo,
                subject: emailSubject,
                html: emailBody,
                fromEmail: selectedFromEmail || undefined
            });
            setSendResult(res);
        } catch (e) {
            console.error(e);
            alert('Failed to send email');
        }
    };

    return (
        <div>
            <h1>Email Outbound Dashboard</h1>

            {!tenantId ? (
                <div className="card">
                    <h2>1. Create Tenant</h2>
                    <input
                        placeholder="Tenant Name"
                        value={tenantName}
                        onChange={e => setTenantName(e.target.value)}
                    />
                    <button onClick={handleCreateTenant}>Create Tenant</button>
                </div>
            ) : (
                <div className="card">
                    <h2>Tenant ID: {tenantId}</h2>
                    <button className="secondary" onClick={() => { setTenantId(''); setLocalTenantId(''); }}>Change Tenant</button>
                </div>
            )}

            {tenantId && (
                <>
                    <div className="grid">
                        <div className="card">
                            <h2>2. Connect Domain</h2>
                            <input
                                placeholder="example.com"
                                value={domain}
                                onChange={e => setDomain(e.target.value)}
                            />
                            <button onClick={handleConnectDomain}>Connect</button>
                            <button className="secondary" onClick={handleCheckStatus}>Check Status</button>

                            {identityData && (
                                <div style={{ marginTop: '1rem' }}>
                                    <p>
                                        Verification: <span className={`status-badge status-${identityData.verification_status}`}>{identityData.verification_status}</span>
                                    </p>
                                    <p>
                                        DKIM: <span className={`status-badge status-${identityData.dkim_status}`}>{identityData.dkim_status}</span>
                                    </p>
                                </div>
                            )}

                            {dnsRecords && (
                                <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                                    <h3>DNS Records</h3>
                                    <p>Add these to your DNS provider:</p>
                                    {dnsRecords.verification && (
                                        <div style={{ marginBottom: '1rem' }}>
                                            <strong>TXT Verification</strong>
                                            <pre>{dnsRecords.verification.name} IN TXT "{dnsRecords.verification.value}"</pre>
                                        </div>
                                    )}
                                    {dnsRecords.dkim.map((r: any, i: number) => (
                                        <div key={i} style={{ marginBottom: '0.5rem' }}>
                                            <strong>DKIM CNAME {i + 1}</strong>
                                            <pre>{r.name} IN CNAME {r.value}</pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="card">
                            <h2>3. Allowed From Addresses</h2>
                            <input
                                placeholder="support@example.com"
                                value={fromEmail}
                                onChange={e => setFromEmail(e.target.value)}
                            />
                            <button onClick={handleAddFrom}>Add Address</button>

                            <div style={{ marginTop: '1rem' }}>
                                {allowedEmails.map(e => (
                                    <div key={e.id} style={{ padding: '0.5rem', background: '#333', marginBottom: '0.5rem', borderRadius: '4px' }}>
                                        {e.email_address} {e.is_default && '(Default)'}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h2>4. Send Email</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                <label style={{ marginBottom: '0.5rem', fontSize: '0.9em', color: '#aaa' }}>From Address:</label>
                                {(() => { console.log('Rendering dropdown, allowedEmails:', allowedEmails); return null; })()}
                                <select
                                    value={selectedFromEmail}
                                    onChange={e => setSelectedFromEmail(e.target.value)}
                                    className="input-field"
                                >
                                    <option value="">-- Select Sender --</option>
                                    {allowedEmails.map(e => (
                                        <option key={e.id} value={e.email_address}>
                                            {e.email_address}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <input
                                placeholder="To: user@example.com"
                                value={emailTo}
                                onChange={e => setEmailTo(e.target.value)}
                            />
                            <input
                                placeholder="Subject"
                                value={emailSubject}
                                onChange={e => setEmailSubject(e.target.value)}
                            />
                            <textarea
                                placeholder="HTML Body"
                                rows={5}
                                value={emailBody}
                                onChange={e => setEmailBody(e.target.value)}
                            />
                            <button onClick={handleSendEmail}>Send Email</button>
                        </div>

                        {sendResult && (
                            <div style={{ marginTop: '1rem', padding: '1rem', background: '#2ecc71', color: 'black', borderRadius: '8px' }}>
                                Email Sent! Message ID: {sendResult.sesMessageId}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default App;
