const { google } = require('googleapis');
const BaseEmailProvider = require('./baseEmailProvider');
const { encrypt, decrypt } = require('../../utils/encryption');

class GmailProvider extends BaseEmailProvider {
    constructor(connectionConfig) {
        super(connectionConfig);
        this.oauth2Client = null;
        this.initializeClient();
    }

    /**
     * Initialize Gmail OAuth2 client
     */
    initializeClient() {
        const credentials = this.connectionConfig.credentials_encrypted 
            ? decrypt(this.connectionConfig.credentials_encrypted)
            : null;

        if (!credentials) {
            throw new Error('Gmail credentials not found');
        }

        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_OAUTH_CLIENT_ID,
            process.env.GOOGLE_OAUTH_CLIENT_SECRET,
            process.env.GOOGLE_OAUTH_REDIRECT_URI
        );

        this.oauth2Client.setCredentials({
            access_token: credentials.access_token,
            refresh_token: credentials.refresh_token,
            expiry_date: credentials.expiry_date
        });

        // Auto-refresh token when expired
        this.oauth2Client.on('tokens', (tokens) => {
            console.log('🔄 Gmail access token refreshed');
            // TODO: Update credentials in database
        });
    }

    /**
     * Get Gmail API client
     */
    getGmailClient() {
        return google.gmail({ version: 'v1', auth: this.oauth2Client });
    }

    /**
     * Send email via Gmail API
     */
    async sendEmail({ from, to, subject, html, text, replyTo, attachments }) {
        try {
            const gmail = this.getGmailClient();

            // Build email message
            const messageParts = [
                `From: ${from || this.connectionConfig.email_address}`,
                `To: ${Array.isArray(to) ? to.join(', ') : to}`,
                `Subject: ${subject}`,
                replyTo ? `Reply-To: ${replyTo}` : null,
                'MIME-Version: 1.0',
                'Content-Type: text/html; charset=utf-8'
            ].filter(part => part !== null); // Only filter out null values, keep empty strings
            
            // CRITICAL: Add blank line separator between headers and body
            messageParts.push('');
            messageParts.push(html || text || '');

            const message = messageParts.join('\r\n'); // Use \r\n for proper email formatting
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage
                }
            });

            return {
                messageId: response.data.id,
                providerMessageId: response.data.id,
                threadId: response.data.threadId
            };
        } catch (error) {
            console.error('Gmail send error:', error);
            throw new Error(`Failed to send email via Gmail: ${error.message}`);
        }
    }

    /**
     * Fetch emails from Gmail
     */
    async fetchEmails({ limit = 50, query = '', pageToken = null }) {
        try {
            const gmail = this.getGmailClient();

            // List messages
            const listResponse = await gmail.users.messages.list({
                userId: 'me',
                maxResults: limit,
                q: query,
                pageToken: pageToken
            });

            const messages = listResponse.data.messages || [];
            const nextPageToken = listResponse.data.nextPageToken;

            // Fetch full message details
            const emails = await Promise.all(
                messages.map(msg => this.getEmail(msg.id))
            );

            return {
                emails: emails.filter(Boolean),
                nextPageToken
            };
        } catch (error) {
            console.error('Gmail fetch error:', error);
            throw new Error(`Failed to fetch emails from Gmail: ${error.message}`);
        }
    }

    /**
     * Get specific email by message ID
     */
    async getEmail(messageId) {
        try {
            const gmail = this.getGmailClient();

            const response = await gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full'
            });

            return this.normalizeEmail(response.data);
        } catch (error) {
            console.error('Gmail get email error:', error);
            return null;
        }
    }

    /**
     * Check Gmail connection status
     */
    async checkConnection() {
        try {
            const gmail = this.getGmailClient();
            
            // Try to get profile to verify connection
            const profile = await gmail.users.getProfile({ userId: 'me' });
            
            return {
                status: 'connected',
                error: null,
                details: {
                    emailAddress: profile.data.emailAddress,
                    messagesTotal: profile.data.messagesTotal,
                    threadsTotal: profile.data.threadsTotal
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
     * Refresh OAuth credentials
     */
    async refreshCredentials() {
        try {
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            
            const encryptedCredentials = encrypt({
                access_token: credentials.access_token,
                refresh_token: credentials.refresh_token,
                expiry_date: credentials.expiry_date
            });

            return {
                success: true,
                credentials: encryptedCredentials
            };
        } catch (error) {
            console.error('Failed to refresh Gmail credentials:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Disconnect Gmail account
     */
    async disconnect() {
        try {
            // Revoke token
            await this.oauth2Client.revokeCredentials();
            
            return { success: true };
        } catch (error) {
            console.error('Failed to disconnect Gmail:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Normalize Gmail message to unified format
     */
    normalizeEmail(gmailMessage) {
        try {
            const headers = gmailMessage.payload.headers.reduce((acc, header) => {
                acc[header.name.toLowerCase()] = header.value;
                return acc;
            }, {});

            // Extract body
            let textBody = '';
            let htmlBody = '';

            const extractBody = (part) => {
                if (part.mimeType === 'text/plain' && part.body.data) {
                    textBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
                } else if (part.mimeType === 'text/html' && part.body.data) {
                    htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
                }

                if (part.parts) {
                    part.parts.forEach(extractBody);
                }
            };

            extractBody(gmailMessage.payload);

            return {
                provider_message_id: gmailMessage.id,
                thread_id: gmailMessage.threadId,
                from: headers['from'],
                to: headers['to'],
                cc: headers['cc'],
                bcc: headers['bcc'],
                subject: headers['subject'],
                text_body: textBody,
                html_body: htmlBody,
                received_at: new Date(parseInt(gmailMessage.internalDate)),
                labels: gmailMessage.labelIds || [],
                raw_data: gmailMessage
            };
        } catch (error) {
            console.error('Failed to normalize Gmail message:', error);
            return null;
        }
    }

    /**
     * Static method: Generate OAuth authorization URL
     */
    static getAuthorizationUrl(state) {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_OAUTH_CLIENT_ID,
            process.env.GOOGLE_OAUTH_CLIENT_SECRET,
            process.env.GOOGLE_OAUTH_REDIRECT_URI
        );

        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/userinfo.email'
        ];

        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            state: state,
            prompt: 'consent' // Force to get refresh token
        });
    }

    /**
     * Static method: Exchange authorization code for tokens
     */
    static async exchangeCodeForTokens(code) {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_OAUTH_CLIENT_ID,
            process.env.GOOGLE_OAUTH_CLIENT_SECRET,
            process.env.GOOGLE_OAUTH_REDIRECT_URI
        );

        const { tokens } = await oauth2Client.getToken(code);
        
        // Get user email
        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        return {
            tokens,
            emailAddress: userInfo.data.email,
            expiresAt: new Date(tokens.expiry_date)
        };
    }
}

module.exports = GmailProvider;
