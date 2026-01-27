const { pool } = require('../../config/db');
const { supabase } = require('../../config/supabase');

/**
 * POST /api/v2/auth/signup-with-otp
 * Send magic link via Supabase
 */
exports.signupWithOTP = async (req, res) => {
    const { email, companyName } = req.body;

    if (!email || !companyName) {
        return res.status(400).json({ 
            error: 'Email and company name are required' 
        });
    }

    try {
        // Check if user already exists
        const existingUser = await pool.query(
            `SELECT * FROM users WHERE email = $1`,
            [email.toLowerCase()]
        );

        const isExistingUser = existingUser.rows.length > 0;

        // Store company name for new signups
        if (!isExistingUser) {
            await pool.query(
                `DELETE FROM pending_signups WHERE email = $1`,
                [email.toLowerCase()]
            );
            
            await pool.query(
                `INSERT INTO pending_signups (email, company_name, verification_status, expires_at)
                 VALUES ($1, $2, 'pending', now() + interval '1 hour')`,
                [email.toLowerCase(), companyName]
            );
        }

        // Send magic link via Supabase
        if (!supabase) {
            return res.status(500).json({ 
                error: 'Authentication service not configured. Please add Supabase credentials to .env' 
            });
        }

        const { data, error } = await supabase.auth.signInWithOtp({
            email: email.toLowerCase(),
            options: {
                shouldCreateUser: true,
                emailRedirectTo: process.env.FRONTEND_URL || 'http://localhost:3000/login'
            }
        });

        if (error) {
            return res.status(500).json({ 
                error: 'Failed to send magic link', 
                details: error.message 
            });
        }

        res.json({ 
            message: 'Check your email for the verification link',
            isExistingUser
        });
    } catch (err) {
        console.error('Signup with OTP error:', err);
        res.status(500).json({ 
            error: 'Failed to initiate signup', 
            details: err.message 
        });
    }
};

/**
 * POST /api/v2/auth/verify-magic-link
 * Complete authentication and create user/tenant if needed
 */
exports.verifyMagicLink = async (req, res) => {
    const { email, companyName, supabaseToken } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        if (!supabase) {
            return res.status(500).json({ error: 'Authentication service not configured' });
        }

        // Verify the Supabase token
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(supabaseToken);

        if (error || !supabaseUser) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Check if user exists in our database
        const existingUser = await pool.query(
            `SELECT u.*, t.id as tenant_id, t.name as tenant_name 
             FROM users u
             LEFT JOIN tenants t ON u.tenant_id = t.id
             WHERE u.email = $1`,
            [email.toLowerCase()]
        );

        let user, tenant;

        if (existingUser.rows.length > 0) {
            // Existing user - sign in
            user = existingUser.rows[0];
            tenant = { id: user.tenant_id, name: user.tenant_name };

            // Update supabase_user_id if not set
            if (!user.supabase_user_id) {
                await pool.query(
                    `UPDATE users SET supabase_user_id = $1 WHERE id = $2`,
                    [supabaseUser.id, user.id]
                );
            }
        } else {
            // New user - complete signup
            const pendingSignup = await pool.query(
                `SELECT * FROM pending_signups 
                 WHERE email = $1 AND verification_status = 'pending'
                 ORDER BY created_at DESC LIMIT 1`,
                [email.toLowerCase()]
            );

            const finalCompanyName = companyName || pendingSignup.rows[0]?.company_name;

            if (!finalCompanyName) {
                return res.status(400).json({ 
                    error: 'Company name is required for new signups' 
                });
            }

            // Create tenant
            const tenantResult = await pool.query(
                `INSERT INTO tenants (name, email, status)
                 VALUES ($1, $2, 'active')
                 RETURNING *`,
                [finalCompanyName, email.toLowerCase()]
            );

            tenant = tenantResult.rows[0];

            // Create user
            const userResult = await pool.query(
                `INSERT INTO users (tenant_id, email, supabase_user_id, name, role, status)
                 VALUES ($1, $2, $3, $4, 'owner', 'active')
                 RETURNING *`,
                [tenant.id, email.toLowerCase(), supabaseUser.id, supabaseUser.user_metadata?.name || email.split('@')[0]]
            );

            user = userResult.rows[0];

            // Mark pending signup as verified
            if (pendingSignup.rows.length > 0) {
                await pool.query(
                    `UPDATE pending_signups 
                     SET verification_status = 'verified', verified_at = now(), supabase_user_id = $1
                     WHERE id = $2`,
                    [supabaseUser.id, pendingSignup.rows[0].id]
                );
            }
        }


        // Generate custom JWT with 7-day expiry (replaces Supabase's short-lived token)
        const customToken = jwt.sign(
            { 
                userId: user.id, 
                tenantId: tenant.id, 
                role: user.role,
                supabaseUserId: supabaseUser.id,
                email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: existingUser.rows.length > 0 ? 'Signed in successfully' : 'Signup completed successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                tenantId: tenant.id,
                tenantName: tenant.name
            },
            session: {
                accessToken: customToken,  // Our custom JWT, not Supabase's
                expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
            }
        });
    } catch (err) {
        console.error('Verify magic link error:', err);
        res.status(500).json({ 
            error: 'Failed to complete authentication', 
            details: err.message 
        });
    }
};

/**
 * POST /api/v2/auth/verify-otp (kept for backward compatibility)
 */
exports.verifyOTPAndSignin = exports.verifyMagicLink;

/**
 * POST /api/v2/auth/resend-otp
 */
exports.resendOTP = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        if (!supabase) {
            return res.status(500).json({ error: 'Authentication service not configured' });
        }

        const { data, error } = await supabase.auth.signInWithOtp({
            email: email.toLowerCase(),
            options: { 
                shouldCreateUser: true,
                emailRedirectTo: process.env.FRONTEND_URL || 'http://localhost:3000/login'
            }
        });

        if (error) {
            return res.status(500).json({ error: 'Failed to resend link', details: error.message });
        }

        res.json({ message: 'Verification link resent to your email' });
    } catch (err) {
        console.error('Resend error:', err);
        res.status(500).json({ error: 'Failed to resend link', details: err.message });
    }
};

/**
 * POST /api/v2/auth/signout
 */
exports.signout = async (req, res) => {
    res.json({ message: 'Signed out successfully' });
};

/**
 * GET /api/v2/auth/me
 */
exports.getCurrentUser = async (req, res) => {
    try {
        const user = req.user;
        res.json({ 
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                tenantId: user.tenant_id,
                tenantName: user.tenant_name
            }
        });
    } catch (err) {
        console.error('Get current user error:', err);
        res.status(500).json({ error: 'Failed to get user info', details: err.message });
    }
};

// =====================================================
// LEGACY PASSWORD-BASED AUTH (BACKWARD COMPATIBILITY)
// =====================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.registerTenant = async (req, res) => {
    const { companyName, email, password, slug } = req.body;

    if (!companyName || !email || !password || !slug) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const tenantResult = await client.query(
            `INSERT INTO tenants (name, slug, plan) VALUES ($1, $2, 'starter') RETURNING id`,
            [companyName, slug]
        );
        const tenantId = tenantResult.rows[0].id;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userResult = await client.query(
            `INSERT INTO users (tenant_id, email, password_hash, name, role, status) 
             VALUES ($1, $2, $3, $4, 'owner', 'active') RETURNING id, email, role`,
            [tenantId, email, hashedPassword, companyName]
        );
        const user = userResult.rows[0];

        await client.query('COMMIT');

        const token = jwt.sign(
            { userId: user.id, tenantId: tenantId, role: user.role },
            process.env.JWT_SECRET,  // No fallback - fail fast if not configured
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Tenant registered successfully',
            token,
            user: { id: user.id, email: user.email, role: user.role, tenantId: tenantId }
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Email or Slug already exists' });
        }
        res.status(500).json({ error: 'Server error during registration' });
    } finally {
        client.release();
    }
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await pool.query(
            `SELECT id, tenant_id, email, password_hash, role, status FROM users WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (!user.password_hash) {
            return res.status(401).json({ 
                error: 'Please use magic link authentication. Password login is no longer supported for this account.',
                useOTP: true
            });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is not active' });
        }

        const token = jwt.sign(
            { userId: user.id, tenantId: user.tenant_id, role: user.role },
            process.env.JWT_SECRET,  // No fallback - fail fast if not configured
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login' });
    }
};
