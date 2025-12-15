const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const registerTenant = async (req, res) => {
  const { companyName, email, password, slug } = req.body;

  if (!companyName || !email || !password || !slug) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create Tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, slug, plan) 
       VALUES ($1, $2, 'starter') 
       RETURNING id`,
      [companyName, slug]
    );
    const tenantId = tenantResult.rows[0].id;

    // 2. Create User (Owner)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userResult = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, name, role, status) 
       VALUES ($1, $2, $3, $4, 'owner', 'active') 
       RETURNING id, email, role`,
      [tenantId, email, hashedPassword, companyName] // Using company name as initial user name for owner
    );
    const user = userResult.rows[0];

    await client.query('COMMIT');

    // Generate Token
    const token = jwt.sign(
      { userId: user.id, tenantId: tenantId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      message: 'Tenant registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: tenantId
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Email or Slug already exists' });
    }
    res.status(500).json({ error: 'Server error during registration' });
  } finally {
    client.release();
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, tenant_id, email, password_hash, role, status 
       FROM users 
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
};

module.exports = {
  registerTenant,
  loginUser
};
