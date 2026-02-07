const { pool } = require('../config/db');

/**
 * Middleware to verify domain ownership before sensitive operations
 * Prevents cross-tenant domain claiming vulnerability
 */
async function requireDomainOwnership(req, res, next) {
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Extract domain from request
    const { domain, identityId } = req.body;
    const { id: paramIdentityId } = req.params;
    
    let domainToCheck = domain;
    const idToCheck = identityId || paramIdentityId;
    
    // If domain not provided but identity ID is, fetch domain from DB
    if (!domainToCheck && idToCheck) {
        try {
            const identity = await pool.query(
                `SELECT identity_value, identity_type FROM tenant_ses_identities WHERE id = $1`,
                [idToCheck]
            );
            
            if (identity.rows.length === 0) {
                return res.status(404).json({ error: 'Domain identity not found' });
            }
            
            domainToCheck = identity.rows[0].identity_value;
        } catch (err) {
            console.error('Error fetching domain for ownership check:', err);
            return res.status(500).json({ error: 'Failed to verify domain ownership' });
        }
    }
    
    if (!domainToCheck) {
        return res.status(400).json({ 
            error: 'Domain or identity ID required for ownership verification' 
        });
    }
    
    try {
        // Check if domain has verified ownership
        const ownershipCheck = await pool.query(`
            SELECT tenant_id, ownership_verified_at, ownership_verification_method
            FROM tenant_ses_identities
            WHERE identity_value = $1 
            AND identity_type = 'domain'
            AND ownership_verified_at IS NOT NULL
        `, [domainToCheck]);
        
        if (ownershipCheck.rows.length === 0) {
            return res.status(403).json({ 
                error: 'Domain ownership not verified',
                message: 'You must verify domain ownership before performing this operation. Use the domain claim workflow first.',
                domain: domainToCheck
            });
        }
        
        const owner = ownershipCheck.rows[0];
        
        // Verify the authenticated tenant owns this domain
        if (owner.tenant_id !== tenantId) {
            return res.status(403).json({ 
                error: 'Domain owned by another organization',
                message: 'Access denied. This domain is verified by a different account.',
                domain: domainToCheck
            });
        }
        
        // Ownership verified - allow operation
        req.verifiedDomain = domainToCheck;
        req.domainOwnershipMethod = owner.ownership_verification_method;
        next();
        
    } catch (err) {
        console.error('Domain ownership verification error:', err);
        return res.status(500).json({ 
            error: 'Failed to verify domain ownership',
            details: err.message 
        });
    }
}

/**
 * Optional middleware for operations that should allow unverified domains
 * but need to check ownership if domain IS verified
 */
async function checkDomainOwnershipIfExists(req, res, next) {
    const tenantId = req.user?.tenantId;
    const { domain } = req.body;
    
    if (!domain || !tenantId) {
        return next();
    }
    
    try {
        const ownershipCheck = await pool.query(`
            SELECT tenant_id FROM tenant_ses_identities
            WHERE identity_value = $1 
            AND identity_type = 'domain'
            AND ownership_verified_at IS NOT NULL
        `, [domain]);
        
        if (ownershipCheck.rows.length > 0 && ownershipCheck.rows[0].tenant_id !== tenantId) {
            return res.status(409).json({ 
                error: 'Domain already verified by another organization',
                message: 'This domain has been verified by another account. If you own this domain, please contact support.',
                domain
            });
        }
        
        next();
    } catch (err) {
        console.error('Domain ownership check error:', err);
        return res.status(500).json({ error: 'Failed to check domain ownership' });
    }
}

module.exports = {
    requireDomainOwnership,
    checkDomainOwnershipIfExists
};
