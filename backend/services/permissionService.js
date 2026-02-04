const { pool } = require('../config/db');

/**
 * Get all effective permissions for a user (role-based + direct overrides)
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} - Array of permission keys
 */
async function getUserPermissions(userId) {
    try {
        const result = await pool.query(`
            SELECT DISTINCT permission_key
            FROM user_effective_permissions
            WHERE user_id = $1 AND is_granted = true
        `, [userId]);
        
        return result.rows.map(row => row.permission_key);
    } catch (error) {
        console.error('Error fetching user permissions:', error);
        return [];
    }
}

/**
 * Check if user has a specific permission
 * @param {string} userId - User ID
 * @param {string} permissionKey - Permission key (e.g., 'campaigns.create')
 * @returns {Promise<boolean>}
 */
async function checkPermission(userId, permissionKey) {
    try {
        const result = await pool.query(`
            SELECT 1
            FROM user_effective_permissions
            WHERE user_id = $1 
            AND permission_key = $2 
            AND is_granted = true
            LIMIT 1
        `, [userId, permissionKey]);
        
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking permission:', error);
        return false;
    }
}

/**
 * Check if user has ANY of the specified permissions
 * @param {string} userId - User ID
 * @param {string[]} permissionKeys - Array of permission keys
 * @returns {Promise<boolean>}
 */
async function hasAnyPermission(userId, permissionKeys) {
    try {
        const result = await pool.query(`
            SELECT 1
            FROM user_effective_permissions
            WHERE user_id = $1 
            AND permission_key = ANY($2)
            AND is_granted = true
            LIMIT 1
        `, [userId, permissionKeys]);
        
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking any permission:', error);
        return false;
    }
}

/**
 * Check if user has ALL of the specified permissions
 * @param {string} userId - User ID
 * @param {string[]} permissionKeys - Array of permission keys
 * @returns {Promise<boolean>}
 */
async function hasAllPermissions(userId, permissionKeys) {
    try {
        const result = await pool.query(`
            SELECT COUNT(DISTINCT permission_key) as count
            FROM user_effective_permissions
            WHERE user_id = $1 
            AND permission_key = ANY($2)
            AND is_granted = true
        `, [userId, permissionKeys]);
        
        return result.rows[0]?.count === permissionKeys.length;
    } catch (error) {
        console.error('Error checking all permissions:', error);
        return false;
    }
}

/**
 * Check if user has super admin role
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
async function isSuperAdmin(userId) {
    try {
        const result = await pool.query(`
            SELECT 1
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = $1 
            AND r.role_name = 'super_admin'
            LIMIT 1
        `, [userId]);
        
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking super admin status:', error);
        return false;
    }
}

/**
 * Get user's allowed inbound email addresses
 * Super admin gets ALL tenant inbound emails automatically
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of {id, email_address}
 */
async function getUserInboundEmails(userId) {
    try {
        // Super admin gets ALL tenant inbound emails
        const isAdmin = await isSuperAdmin(userId);
        
        if (isAdmin) {
            // Get user's tenant
            const userResult = await pool.query(`SELECT tenant_id FROM users WHERE id = $1`, [userId]);
            if (userResult.rows.length === 0) return [];
            
            const tenantId = userResult.rows[0].tenant_id;
            
            // Return ALL tenant inbound emails
            const result = await pool.query(`
                SELECT id, email_address
                FROM allowed_inbound_emails
                WHERE tenant_id = $1
            `, [tenantId]);
            
            return result.rows;
        }
        
        // Regular users: use access control
        const result = await pool.query(`
            SELECT aie.id, aie.email_address
            FROM user_inbound_email_access uiea
            JOIN allowed_inbound_emails aie ON aie.id = uiea.allowed_inbound_email_id
            WHERE uiea.user_id = $1
        `, [userId]);
        
        return result.rows;
    } catch (error) {
        console.error('Error fetching user inbound emails:', error);
        return [];
    }
}

/**
 * Get user's allowed outbound email addresses (for sending)
 * Super admin gets ALL tenant email connections and SES identities automatically
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of email details with connection/identity info
 */
async function getUserOutboundEmails(userId) {
    try {
        // Super admin gets ALL tenant outbound emails
        const isAdmin = await isSuperAdmin(userId);
        
        if (isAdmin) {
            // Get user's tenant
            const userResult = await pool.query(`SELECT tenant_id FROM users WHERE id = $1`, [userId]);
            if (userResult.rows.length === 0) return [];
            
            const tenantId = userResult.rows[0].tenant_id;
            
            // Return ALL tenant email connections and SES emails
            const result = await pool.query(`
                -- Get all Gmail/Outlook connections
                SELECT 
                    tec.id,
                    'connection' as email_type,
                    tec.id as email_connection_id,
                    NULL::uuid as ses_identity_id,
                    NULL::uuid as allowed_from_email_id,
                    tec.email_address as connection_email,
                    tec.display_name as connection_display_name,
                    NULL as ses_email,
                    NULL as ses_identity_value
                FROM tenant_email_connections tec
                WHERE tec.tenant_id = $1 AND tec.is_active = true
                
                UNION ALL
                
                -- Get all SES allowed from emails
                SELECT
                    tafe.id,
                    'identity' as email_type,
                    NULL::uuid as email_connection_id,
                    tafe.ses_identity_id,
                    tafe.id as allowed_from_email_id,
                    NULL as connection_email,
                    NULL as connection_display_name,
                    tafe.email_address as ses_email,
                    tsi.identity_value as ses_identity_value
                FROM tenant_allowed_from_emails tafe
                LEFT JOIN tenant_ses_identities tsi ON tsi.id = tafe.ses_identity_id
                WHERE tafe.tenant_id = $1
            `, [tenantId]);
            
            return result.rows.map(row => ({
                id: row.id,
                email_type: row.email_type,
                email_address: row.connection_email || row.ses_email,
                display_name: row.connection_display_name,
                connection_id: row.email_connection_id,
                ses_identity_id: row.ses_identity_id,
                allowed_from_email_id: row.allowed_from_email_id
            }));
        }
        
        // Regular users: use access control
        const result = await pool.query(`
            SELECT 
                uoea.id,
                uoea.email_type,
                uoea.email_connection_id,
                uoea.ses_identity_id,
                uoea.allowed_from_email_id,
                -- Get email address from connection
                tec.email_address as connection_email,
                tec.display_name as connection_display_name,
                -- Get email address from SES
                tafe.email_address as ses_email,
                tsi.identity_value as ses_identity_value
            FROM user_outbound_email_access uoea
            LEFT JOIN tenant_email_connections tec ON tec.id = uoea.email_connection_id
            LEFT JOIN tenant_allowed_from_emails tafe ON tafe.id = uoea.allowed_from_email_id
            LEFT JOIN tenant_ses_identities tsi ON tsi.id = uoea.ses_identity_id
            WHERE uoea.user_id = $1
        `, [userId]);
        
        return result.rows.map(row => ({
            id: row.id,
            email_type: row.email_type,
            email_address: row.connection_email || row.ses_email,
            display_name: row.connection_display_name,
            connection_id: row.email_connection_id,
            ses_identity_id: row.ses_identity_id,
            allowed_from_email_id: row.allowed_from_email_id
        }));
    } catch (error) {
        console.error('Error fetching user outbound emails:', error);
        return [];
    }
}

/**
 * Get user's allowed phone numbers
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of phone configs
 */
async function getUserPhoneNumbers(userId) {
    try {
        const result = await pool.query(`
            SELECT tpc.*
            FROM user_phone_access upa
            JOIN tenant_phone_config tpc ON tpc.id = upa.phone_config_id
            WHERE upa.user_id = $1 AND tpc.is_active = true
        `, [userId]);
        
        return result.rows;
    } catch (error) {
        console.error('Error fetching user phone numbers:', error);
        return [];
    }
}

/**
 * Get user's allowed WhatsApp accounts
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of WhatsApp accounts
 */
async function getUserWhatsAppAccounts(userId) {
    try {
        const result = await pool.query(`
            SELECT twa.*
            FROM user_whatsapp_access uwa
            JOIN tenant_whatsapp_accounts twa ON twa.id = uwa.whatsapp_account_id
            WHERE uwa.user_id = $1 AND twa.is_active = true
        `, [userId]);
        
        return result.rows;
    } catch (error) {
        console.error('Error fetching user WhatsApp accounts:', error);
        return [];
    }
}

/**
 * Check if user can access a specific lead
 * @param {string} userId - User ID
 * @param {string} leadId - Lead ID
 * @returns {Promise<boolean>}
 */
async function canAccessLead(userId, leadId) {
    try {
        // Check if user has leads.view_all permission
        const hasViewAll = await checkPermission(userId, 'leads.view_all');
        if (hasViewAll) return true;
        
        // Otherwise, check if lead is assigned to user
        const result = await pool.query(`
            SELECT 1
            FROM user_lead_assignments
            WHERE user_id = $1 AND lead_id = $2
            LIMIT 1
        `, [userId, leadId]);
        
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking lead access:', error);
        return false;
    }
}

/**
 * Check if user can access a specific contact
 * @param {string} userId - User ID
 * @param {string} contactId - Contact ID
 * @returns {Promise<boolean>}
 */
async function canAccessContact(userId, contactId) {
    try {
        // Check if user has contacts.view_all permission
        const hasViewAll = await checkPermission(userId, 'contacts.view_all');
        if (hasViewAll) return true;
        
        // Otherwise, check if contact is assigned to user
        const result = await pool.query(`
            SELECT 1
            FROM user_contact_assignments
            WHERE user_id = $1 AND contact_id = $2
            LIMIT 1
        `, [userId, contactId]);
        
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking contact access:', error);
        return false;
    }
}

/**
 * Get leads accessible to user (respects assignments and view_all permission)
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<string>} - SQL WHERE clause condition
 */
async function getLeadsAccessCondition(userId, tenantId) {
    const hasViewAll = await checkPermission(userId, 'leads.view_all');
    
    if (hasViewAll) {
        return `leads.tenant_id = '${tenantId}'`;
    } else {
        return `leads.id IN (
            SELECT lead_id FROM user_lead_assignments WHERE user_id = '${userId}'
        )`;
    }
}

/**
 * Get contacts accessible to user (respects assignments and view_all permission)
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<string>} - SQL WHERE clause condition
 */
async function getContactsAccessCondition(userId, tenantId) {
    const hasViewAll = await checkPermission(userId, 'contacts.view_all');
    
    if (hasViewAll) {
        return `contacts.tenant_id = '${tenantId}'`;
    } else {
        return `contacts.id IN (
            SELECT contact_id FROM user_contact_assignments WHERE user_id = '${userId}'
        )`;
    }
}

/**
 * Check if user can access a feature (respects tenant + user-level overrides)
 * Super admin gets automatic access to all features
 * @param {string} userId - User ID
 * @param {string} featureKey - Feature key (e.g., 'ticketing', 'workflow')
 * @returns {Promise<boolean>}
 */
async function canAccessFeature(userId, featureKey) {
    try {
        // Super admin gets access to ALL features automatically
        const isAdmin = await isSuperAdmin(userId);
        if (isAdmin) return true;
        
        // 1. Get user info (tenant_id)
        const userResult = await pool.query(`
            SELECT tenant_id FROM users WHERE id = $1
        `, [userId]);
        
        if (userResult.rows.length === 0) return false;
        const tenantId = userResult.rows[0].tenant_id;
        
        // 2. Check if user has the required view permission for the feature
        const hasPermission = await checkPermission(userId, `${featureKey}.view`);
        if (!hasPermission) return false;
        
        // 3. Check tenant-level feature enablement
        const tenantFeatureResult = await pool.query(`
            SELECT is_enabled FROM tenant_features
            WHERE tenant_id = $1 AND feature_key = $2
        `, [tenantId, featureKey]);
        
        const tenantEnabled = tenantFeatureResult.rows.length > 0 && 
                             tenantFeatureResult.rows[0].is_enabled;
        
        // 4. If tenant has it enabled, user has access
        if (tenantEnabled) return true;
        
        // 5. If tenant disabled, check user-specific override
        const userOverrideResult = await pool.query(`
            SELECT is_enabled FROM user_feature_access
            WHERE user_id = $1 AND feature_key = $2
        `, [userId, featureKey]);
        
        return userOverrideResult.rows.length > 0 && 
               userOverrideResult.rows[0].is_enabled;
    } catch (error) {
        console.error('Error checking feature access:', error);
        return false;
    }
}

/**
 * Check if user can manage an AI deployment on a specific resource
 * @param {string} userId - User ID
 * @param {string} resourceId - AI deployment resource ID
 * @param {string} action - Action: 'view', 'enable_disable', or 'configure'
 * @returns {Promise<boolean>}
 */
async function canManageAIDeployment(userId, resourceId, action = 'view') {
    try {
        // 1. Check if user has ai.deploy_all permission (admin bypass)
        const hasDeployAll = await checkPermission(userId, 'ai.deploy_all');
        if (hasDeployAll) return true;
        
        // 2. Check if user has ai.deploy permission
        const hasDeploy = await checkPermission(userId, 'ai.deploy');
        if (!hasDeploy) return false;
        
        // 3. Check user-specific delegation for this resource
        const delegationResult = await pool.query(`
            SELECT can_view, can_enable_disable, can_configure
            FROM user_ai_deployment_permissions
            WHERE user_id = $1 AND ai_deployment_resource_id = $2
        `, [userId, resourceId]);
        
        if (delegationResult.rows.length === 0) return false;
        
        const delegation = delegationResult.rows[0];
        
        // 4. Check permission based on action
        switch (action) {
            case 'view':
                return delegation.can_view;
            case 'enable_disable':
                return delegation.can_enable_disable;
            case 'configure':
                return delegation.can_configure;
            default:
                return false;
        }
    } catch (error) {
        console.error('Error checking AI deployment permission:', error);
        return false;
    }
}

/**
 * Get all AI deployment resources the user can manage (with their permission levels)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of {resource_id, can_view, can_enable_disable, can_configure, ...resource_info}
 */
async function getUserAIDeployments(userId) {
    try {
        // Check if user has ai.deploy_all permission
        const hasDeployAll = await checkPermission(userId, 'ai.deploy_all');
        
        if (hasDeployAll) {
            // Return all AI deployments for tenant
            const userResult = await pool.query(`
                SELECT tenant_id FROM users WHERE id = $1
            `, [userId]);
            
            if (userResult.rows.length === 0) return [];
            const tenantId = userResult.rows[0].tenant_id;
            
            const result = await pool.query(`
                SELECT 
                    id as resource_id,
                    channel,
                    resource_display_name,
                    is_enabled,
                    schedule_enabled,
                    priority_mode,
                    true as can_view,
                    true as can_enable_disable,
                    true as can_configure
                FROM ai_deployment_resources
                WHERE tenant_id = $1
                ORDER BY channel, resource_display_name
            `, [tenantId]);
            
            return result.rows;
        } else {
            // Return only delegated resources
            const result = await pool.query(`
                SELECT 
                    adr.id as resource_id,
                    adr.channel,
                    adr.resource_display_name,
                    adr.is_enabled,
                    adr.schedule_enabled,
                    adr.priority_mode,
                    uadp.can_view,
                    uadp.can_enable_disable,
                    uadp.can_configure
                FROM user_ai_deployment_permissions uadp
                JOIN ai_deployment_resources adr ON adr.id = uadp.ai_deployment_resource_id
                WHERE uadp.user_id = $1
                ORDER BY adr.channel, adr.resource_display_name
            `, [userId]);
            
            return result.rows;
        }
    } catch (error) {
        console.error('Error fetching user AI deployments:', error);
        return [];
    }
}

module.exports = {
    getUserPermissions,
    checkPermission,
    hasAnyPermission,
    hasAllPermissions,
    isSuperAdmin,
    getUserInboundEmails,
    getUserOutboundEmails,
    getUserPhoneNumbers,
    getUserWhatsAppAccounts,
    canAccessLead,
    canAccessContact,
    getLeadsAccessCondition,
    getContactsAccessCondition,
    canAccessFeature,
    canManageAIDeployment,
    getUserAIDeployments
};
