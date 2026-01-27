const { pool } = require('../config/db');
const whatsappService = require('../whatsapp/services/whatsappService');
const widgetService = require('../chat_widget/services/widgetService');

// ===== WHATSAPP CONFIG =====

// GET /api/channels/whatsapp - Get WhatsApp config
exports.getWhatsappConfig = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
            `SELECT id, tenant_id, phone_number, is_active, created_at, updated_at 
             FROM tenant_whatsapp_accounts WHERE tenant_id = $1`,
            [tenantId]
        );

        res.json({ 
            config: result.rows[0] || null,
            webhookUrl: `${process.env.BASE_URL || 'https://your-domain.com'}/api/webhooks/whatsapp`
        });
    } catch (err) {
        console.error("Error getting WhatsApp config:", err);
        res.status(500).json({ error: "Failed to get WhatsApp config" });
    }
};

// POST /api/channels/whatsapp - Create/update WhatsApp config
exports.upsertWhatsappConfig = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { twilioAccountSid, twilioAuthToken, phoneNumber } = req.body;

    if (!twilioAccountSid || !twilioAuthToken || !phoneNumber) {
        return res.status(400).json({ error: "twilioAccountSid, twilioAuthToken, and phoneNumber required" });
    }

    try {
        const config = await whatsappService.upsertAccount(tenantId, {
            twilioAccountSid,
            twilioAuthToken,
            phoneNumber: phoneNumber.startsWith('whatsapp:') ? phoneNumber : `whatsapp:${phoneNumber}`
        });

        res.json({ 
            config: {
                id: config.id,
                tenant_id: config.tenant_id,
                phone_number: config.phone_number,
                is_active: config.is_active
            },
            message: "WhatsApp configuration saved"
        });
    } catch (err) {
        console.error("Error saving WhatsApp config:", err);
        res.status(500).json({ error: "Failed to save WhatsApp config" });
    }
};

// DELETE /api/channels/whatsapp - Deactivate WhatsApp
exports.deactivateWhatsapp = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        await pool.query(
            `UPDATE tenant_whatsapp_accounts SET is_active = false, updated_at = now() WHERE tenant_id = $1`,
            [tenantId]
        );
        res.json({ message: "WhatsApp deactivated" });
    } catch (err) {
        console.error("Error deactivating WhatsApp:", err);
        res.status(500).json({ error: "Failed to deactivate WhatsApp" });
    }
};

// ===== WIDGET CONFIG =====

// GET /api/channels/widget - Get Widget config
exports.getWidgetConfig = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const config = await widgetService.getConfigByTenantId(tenantId);

        if (!config) {
            return res.json({ config: null });
        }

        // Generate embed code
        const embedCode = `<script src="${process.env.WIDGET_SCRIPT_URL || 'https://cdn.your-domain.com/widget.js'}" data-id="${config.public_key}"></script>`;

        res.json({ 
            config: {
                id: config.id,
                publicKey: config.public_key,
                allowedDomains: config.allowed_domains,
                theme: config.theme,
                welcomeMessage: config.welcome_message,
                requireEmail: config.require_email,
                isActive: config.is_active
            },
            embedCode
        });
    } catch (err) {
        console.error("Error getting Widget config:", err);
        res.status(500).json({ error: "Failed to get Widget config" });
    }
};

// POST /api/channels/widget - Create/update Widget config
exports.upsertWidgetConfig = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { allowedDomains, theme, welcomeMessage, requireEmail } = req.body;

    try {
        const config = await widgetService.upsertConfig(tenantId, {
            allowedDomains,
            theme,
            welcomeMessage,
            requireEmail
        });

        const embedCode = `<script src="${process.env.WIDGET_SCRIPT_URL || 'https://cdn.your-domain.com/widget.js'}" data-id="${config.public_key}"></script>`;

        res.json({ 
            config: {
                id: config.id,
                publicKey: config.public_key,
                allowedDomains: config.allowed_domains,
                theme: config.theme,
                welcomeMessage: config.welcome_message,
                requireEmail: config.require_email,
                isActive: config.is_active
            },
            embedCode,
            message: "Widget configuration saved"
        });
    } catch (err) {
        console.error("Error saving Widget config:", err);
        res.status(500).json({ error: "Failed to save Widget config" });
    }
};

// DELETE /api/channels/widget - Deactivate Widget
exports.deactivateWidget = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        await pool.query(
            `UPDATE tenant_widget_config SET is_active = false, updated_at = now() WHERE tenant_id = $1`,
            [tenantId]
        );
        res.json({ message: "Widget deactivated" });
    } catch (err) {
        console.error("Error deactivating Widget:", err);
        res.status(500).json({ error: "Failed to deactivate Widget" });
    }
};

// ===== PHONE CONFIG =====

// GET /api/channels/phone - Get Phone config
exports.getPhoneConfig = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        const result = await pool.query(
            `SELECT id, tenant_id, phone_number, voice_model, transcription_enabled, recording_enabled, is_active, created_at 
             FROM tenant_phone_config WHERE tenant_id = $1`,
            [tenantId]
        );

        res.json({ 
            config: result.rows[0] || null,
            webhookUrl: `${process.env.BASE_URL || 'https://your-domain.com'}/api/webhooks/twilio/voice`
        });
    } catch (err) {
        console.error("Error getting Phone config:", err);
        res.status(500).json({ error: "Failed to get Phone config" });
    }
};

// POST /api/channels/phone - Create/update Phone config
exports.upsertPhoneConfig = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { twilioAccountSid, twilioAuthToken, phoneNumber, voiceModel, transcriptionEnabled, recordingEnabled } = req.body;

    if (!twilioAccountSid || !twilioAuthToken || !phoneNumber) {
        return res.status(400).json({ error: "twilioAccountSid, twilioAuthToken, and phoneNumber required" });
    }

    try {
        const result = await pool.query(
            `INSERT INTO tenant_phone_config (
                tenant_id, twilio_account_sid, twilio_auth_token, phone_number,
                voice_model, transcription_enabled, recording_enabled
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (tenant_id) DO UPDATE SET
                twilio_account_sid = EXCLUDED.twilio_account_sid,
                twilio_auth_token = EXCLUDED.twilio_auth_token,
                phone_number = EXCLUDED.phone_number,
                voice_model = EXCLUDED.voice_model,
                transcription_enabled = EXCLUDED.transcription_enabled,
                recording_enabled = EXCLUDED.recording_enabled,
                updated_at = now()
            RETURNING id, tenant_id, phone_number, voice_model, transcription_enabled, recording_enabled, is_active`,
            [tenantId, twilioAccountSid, twilioAuthToken, phoneNumber, 
             voiceModel || 'en-US-Neural2-F', transcriptionEnabled !== false, recordingEnabled === true]
        );

        res.json({ 
            config: result.rows[0],
            message: "Phone configuration saved"
        });
    } catch (err) {
        console.error("Error saving Phone config:", err);
        res.status(500).json({ error: "Failed to save Phone config" });
    }
};

// DELETE /api/channels/phone - Deactivate Phone
exports.deactivatePhone = async (req, res) => {
    const tenantId = req.user.tenantId;

    try {
        await pool.query(
            `UPDATE tenant_phone_config SET is_active = false, updated_at = now() WHERE tenant_id = $1`,
            [tenantId]
        );
        res.json({ message: "Phone deactivated" });
    } catch (err) {
        console.error("Error deactivating Phone:", err);
        res.status(500).json({ error: "Failed to deactivate Phone" });
    }
};
