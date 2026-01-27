const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Get encryption key from environment or generate one
 * IMPORTANT: Set ENCRYPTION_KEY in .env to a secure 32-byte hex string
 */
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    
    if (!key) {
        console.warn(
            '⚠️  WARNING: ENCRYPTION_KEY not set in environment. ' +
            'Using development key. DO NOT USE IN PRODUCTION!'
        );
        // Development fallback - DO NOT USE IN PRODUCTION
        return crypto.scryptSync('dev-key-insecure', 'salt', 32);
    }
    
    // Convert hex string to buffer
    if (key.length === 64) {
        return Buffer.from(key, 'hex');
    }
    
    // Derive key from password
    const salt = crypto.createHash('sha256').update('custareaEmailEncryption').digest();
    return crypto.scryptSync(key, salt, 32);
}

/**
 * Encrypt sensitive data (OAuth tokens, API keys, etc.)
 * @param {Object|string} data - Data to encrypt
 * @returns {string} - Encrypted data as base64 string
 */
function encrypt(data) {
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const salt = crypto.randomBytes(SALT_LENGTH);
        
        // Convert data to JSON string if it's an object
        const text = typeof data === 'string' ? data : JSON.stringify(data);
        
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([
            cipher.update(text, 'utf8'),
            cipher.final()
        ]);
        
        const tag = cipher.getAuthTag();
        
        // Combine salt + iv + tag + encrypted data
        const result = Buffer.concat([salt, iv, tag, encrypted]);
        
        return result.toString('base64');
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypt encrypted data
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @returns {Object|string} - Decrypted data
 */
function decrypt(encryptedData) {
    try {
        const key = getEncryptionKey();
        const data = Buffer.from(encryptedData, 'base64');
        
        // Extract components
        const salt = data.subarray(0, SALT_LENGTH);
        const iv = data.subarray(SALT_LENGTH, TAG_POSITION);
        const tag = data.subarray(TAG_POSITION, ENCRYPTED_POSITION);
        const encrypted = data.subarray(ENCRYPTED_POSITION);
        
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        
        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);
        
        const text = decrypted.toString('utf8');
        
        // Try to parse as JSON, return as string if it fails
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
}

/**
 * Generate a secure encryption key for .env file
 * Run this function and save the output to ENCRYPTION_KEY in .env
 */
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = {
    encrypt,
    decrypt,
    generateEncryptionKey
};
