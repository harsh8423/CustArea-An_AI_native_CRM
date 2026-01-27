const axios = require('axios');
const BaseEmailProvider = require('./baseEmailProvider');
const { encrypt, decrypt } = require('../../utils/encryption');

class OutlookProvider extends BaseEmailProvider {
    constructor(connectionConfig) {
        super(connectionConfig);
        this.accessToken = null;
        this.refreshToken = null;
        this.expiryDate = null;
        this.initializeClient();
    }

    /**
     * Initialize Outlook OAuth credentials
     */
    initializeClient() {
        const credentials = this.connectionConfig.credentials_encrypted 
            ? decrypt(this.connectionConfig.credentials_encrypted)
            : null;

        if (!credentials) {
            throw new Error('Outlook credentials not found');
        }

        this.accessToken = credentials.access_token;
        this.refreshToken = credentials.refresh_token;
        this.expiryDate = credentials.expiry_date;
    }

    /**
     * Get valid access token (refresh if expired)
     */
    async getAccessToken() {
        // Check if token is expired or expiring soon (5 min buffer)
        if (this.expiryDate && Date.now() >= this.expiryDate - 300000) {
            await this.refreshAccessToken();
        }
        return this.accessToken;
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken() {
        try {
            const response = await axios.post(
                'https://login.microsoftonline.com/common/oauth2/v2.0/token',
                new URLSearchParams({
                    client_id: process.env.MICROSOFT_OAUTH_CLIENT_ID,
                    client_secret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
                    refresh_token: this.refreshToken,
                    grant_type: 'refresh_token',
                    scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access'
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            this.accessToken = response.data.access_token;
            this.expiryDate = Date.now() + (response.data.expires_in * 1000);

            // Update refresh token if provided
            if (response.data.refresh_token) {
                this.refreshToken = response.data.refresh_token;
            }

            console.log('🔄 Outlook access token refreshed');
            
            // TODO: Update credentials in database
            return {
                success: true,
                accessToken: this.accessToken,
                expiryDate: this.expiryDate
            };
        } catch (error) {
            console.error('Failed to refresh Outlook token:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send email via Microsoft Graph API
     */
    async sendEmail({ from, to, subject, html, text, replyTo, attachments }) {
        try {
            const token = await this.getAccessToken();

            // Build email message in Microsoft Graph format
            const message = {
                subject: subject,
                body: {
                    contentType: html ? 'HTML' : 'Text',
                    content: html || text || ''
                },
                toRecipients: (Array.isArray(to) ? to : [to]).map(email => ({
                    emailAddress: { address: email }
                }))
            };

            // Add from address if specified
            if (from) {
                message.from = {
                    emailAddress: { address: from }
                };
            }

            // Add reply-to if specified
            if (replyTo) {
                message.replyTo = [{
                    emailAddress: { address: replyTo }
                }];
            }

            // Add attachments if provided
            if (attachments && attachments.length > 0) {
                message.attachments = attachments.map(att => ({
                    '@odata.type': '#microsoft.graph.fileAttachment',
                    name: att.filename,
                    contentBytes: att.content.toString('base64'),
                    contentType: att.contentType || 'application/octet-stream'
                }));
            }

            const response = await axios.post(
                'https://graph.microsoft.com/v1.0/me/sendMail',
                { message, saveToSentItems: true },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                messageId: response.headers['request-id'] || Date.now().toString(),
                providerMessageId: response.headers['request-id'],
                success: true
            };
        } catch (error) {
            console.error('Outlook send error:', error.response?.data || error.message);
            throw new Error(`Failed to send email via Outlook: ${error.message}`);
        }
    }

    /**
     * Fetch emails from Outlook mailbox
     */
    async fetchEmails({ limit = 50, query = '', pageToken = null }) {
        try {
            const token = await this.getAccessToken();

            let url = `https://graph.microsoft.com/v1.0/me/messages?$top=${Math.min(limit, 100)}&$orderby=receivedDateTime DESC`;
            
            if (query) {
                url += `&$filter=contains(subject,'${query}') or contains(from/emailAddress/address,'${query}')`;
            }
            
            if (pageToken) {
                url = pageToken; // pageToken is the full next link URL
            }

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const messages = response.data.value || [];
            const nextPageToken = response.data['@odata.nextLink'] || null;

            const emails = messages.map(msg => this.normalizeEmail(msg));

            return {
                emails,
                nextPageToken
            };
        } catch (error) {
            console.error('Outlook fetch error:', error.response?.data || error.message);
            throw new Error(`Failed to fetch emails from Outlook: ${error.message}`);
        }
    }

    /**
     * Get specific email by message ID
     */
    async getEmail(messageId) {
        try {
            const token = await this.getAccessToken();

            const response = await axios.get(
                `https://graph.microsoft.com/v1.0/me/messages/${messageId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return this.normalizeEmail(response.data);
        } catch (error) {
            console.error('Outlook get email error:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Check Outlook connection status
     */
    async checkConnection() {
        try {
            const token = await this.getAccessToken();
            
            const response = await axios.get(
                'https://graph.microsoft.com/v1.0/me',
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            return {
                status: 'connected',
                error: null,
                details: {
                    emailAddress: response.data.mail || response.data.userPrincipalName,
                    displayName: response.data.displayName
                }
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                details: null
            };
        }
    }

    /**
     * Disconnect Outlook account
     */
    async disconnect() {
        try {
            // Note: Microsoft doesn't provide a token revocation endpoint for personal accounts
            // The token will naturally expire. For enterprise apps, you'd use the revoke endpoint.
            console.log('Outlook connection will be deactivated (tokens expire naturally)');
            
            return { success: true };
        } catch (error) {
            console.error('Failed to disconnect Outlook:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Normalize Outlook message to unified format
     */
    normalizeEmail(outlookMessage) {
        try {
            return {
                provider_message_id: outlookMessage.id,
                thread_id: outlookMessage.conversationId,
                from: outlookMessage.from?.emailAddress?.address,
                to: outlookMessage.toRecipients?.map(r => r.emailAddress.address).join(', '),
                cc: outlookMessage.ccRecipients?.map(r => r.emailAddress.address).join(', '),
                bcc: outlookMessage.bccRecipients?.map(r => r.emailAddress.address).join(', '),
                subject: outlookMessage.subject,
                text_body: outlookMessage.body?.contentType === 'text' ? outlookMessage.body.content : null,
                html_body: outlookMessage.body?.contentType === 'html' ? outlookMessage.body.content : null,
                received_at: new Date(outlookMessage.receivedDateTime),
                labels: outlookMessage.categories || [],
                raw_data: outlookMessage
            };
        } catch (error) {
            console.error('Failed to normalize Outlook message:', error);
            return null;
        }
    }

    /**
     * Static method: Generate OAuth authorization URL
     */
    static getAuthorizationUrl(state) {
        const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
        const redirectUri = process.env.MICROSOFT_OAUTH_REDIRECT_URI;
        const tenant = process.env.MICROSOFT_OAUTH_TENANT || 'common';

        const scopes = [
            'https://graph.microsoft.com/Mail.Send',
            'https://graph.microsoft.com/Mail.Read',
            'https://graph.microsoft.com/User.Read',
            'offline_access'
        ];

        const params = new URLSearchParams({
            client_id: clientId,
            response_type: 'code',
            redirect_uri: redirectUri,
            scope: scopes.join(' '),
            state: state,
            response_mode: 'query',
            prompt: 'consent' // Force to get refresh token
        });

        return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
    }

    /**
     * Static method: Exchange authorization code for tokens
     */
    static async exchangeCodeForTokens(code) {
        const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
        const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
        const redirectUri = process.env.MICROSOFT_OAUTH_REDIRECT_URI;
        const tenant = process.env.MICROSOFT_OAUTH_TENANT || 'common';

        const response = await axios.post(
            `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
            new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access'
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        const tokens = response.data;
        
        // Get user email
        const userResponse = await axios.get(
            'https://graph.microsoft.com/v1.0/me',
            {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            tokens: {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expiry_date: Date.now() + (tokens.expires_in * 1000),
                scope: tokens.scope
            },
            emailAddress: userResponse.data.mail || userResponse.data.userPrincipalName,
            expiresAt: new Date(Date.now() + (tokens.expires_in * 1000))
        };
    }
}

module.exports = OutlookProvider;
