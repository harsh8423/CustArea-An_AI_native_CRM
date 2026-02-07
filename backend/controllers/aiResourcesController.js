const { pool } = require('../config/db');

/**
 * Get all available resources that can have AI deployed
 * This includes email addresses, phone numbers, whatsapp accounts, and widgets
 * GET /api/ai/available-resources
 */
async function getAvailableResources(req, res) {
    try {
        const tenantId = req.user.tenantId;
        
        const resources = {
            email: [],
            phone: [],
            whatsapp: [],
            widget: []
        };

        // Get email addresses (both inbound emails AND Gmail/Outlook connections)
        // Gmail/Outlook connections can both send and receive, so they should be available for AI deployment
        const emailResult = await pool.query(`
            -- Inbound email addresses
            SELECT 
                aie.id,
                aie.email_address as display_name,
                'inbound' as source_type,
                aie.is_active,
                CASE WHEN adr.id IS NOT NULL THEN true ELSE false END as has_deployment,
                adr.id as deployment_id,
                adr.is_enabled as ai_enabled
            FROM allowed_inbound_emails aie
            LEFT JOIN ai_deployment_resources adr 
                ON adr.allowed_inbound_email_id = aie.id 
                AND adr.channel = 'email'
            WHERE aie.tenant_id = $1
                AND aie.is_active = true
            
            ORDER BY display_name
        `, [tenantId]);
        
        console.log(`[AI Resources] Found ${emailResult.rows.length} email resources for tenant ${tenantId}:`);
        emailResult.rows.forEach(row => {
            console.log(`  - ${row.display_name} (${row.source_type}) | Active: ${row.is_active} | Has Deployment: ${row.has_deployment} | AI Enabled: ${row.ai_enabled}`);
        });
        
        resources.email = emailResult.rows;

        // Get phone numbers
        const phoneResult = await pool.query(`
            SELECT 
                tpc.id,
                tpc.phone_number as display_name,
                tpc.is_active,
                tpc.is_phone_enabled as phone_feature_enabled,
                CASE WHEN adr.id IS NOT NULL THEN true ELSE false END as has_deployment,
                adr.id as deployment_id,
                adr.is_enabled as ai_enabled
            FROM tenant_phone_config tpc
            LEFT JOIN ai_deployment_resources adr 
                ON adr.phone_config_id = tpc.id 
                AND adr.channel = 'phone'
            WHERE tpc.tenant_id = $1
                AND tpc.is_active = true
            ORDER BY tpc.phone_number
        `, [tenantId]);
        resources.phone = phoneResult.rows;

        // Get WhatsApp accounts
        const whatsappResult = await pool.query(`
            SELECT 
                twa.id,
                twa.phone_number as display_name,
                twa.is_active,
                CASE WHEN adr.id IS NOT NULL THEN true ELSE false END as has_deployment,
                adr.id as deployment_id,
                adr.is_enabled as ai_enabled
            FROM tenant_whatsapp_accounts twa
            LEFT JOIN ai_deployment_resources adr 
                ON adr.whatsapp_account_id = twa.id 
                AND adr.channel = 'whatsapp'
            WHERE twa.tenant_id = $1
                AND twa.is_active = true
            ORDER BY twa.phone_number
        `, [tenantId]);
        resources.whatsapp = whatsappResult.rows;

        // Get widget configs
        const widgetResult = await pool.query(`
            SELECT 
                twc.id,
                'Chat Widget' as display_name,
                twc.is_active,
                CASE WHEN adr.id IS NOT NULL THEN true ELSE false END as has_deployment,
                adr.id as deployment_id,
                adr.is_enabled as ai_enabled
            FROM tenant_widget_config twc
            LEFT JOIN ai_deployment_resources adr 
                ON adr.widget_config_id = twc.id 
                AND adr.channel = 'widget'
            WHERE twc.tenant_id = $1
            ORDER BY twc.created_at DESC
        `, [tenantId]);
        resources.widget = widgetResult.rows;

        res.status(200).json({
            success: true,
            data: resources
        });
    } catch (err) {
        console.error('Error fetching available resources:', err);
        res.status(500).json({
            error: 'Failed to fetch available resources',
            details: err.message
        });
    }
}

module.exports = {
    getAvailableResources
};
