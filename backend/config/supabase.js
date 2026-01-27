const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
let supabaseAdmin = null;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️  Supabase not configured. Magic link authentication will not work.');
    console.warn('⚠️  Set SUPABASE_URL and SUPABASE_ANON_KEY in .env to enable authentication.');
} else {
    try {
        // Client for user-facing operations
        supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        // Admin client for server-side operations
        if (supabaseServiceKey) {
            supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        }
        
        console.log('✅ Supabase client initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize Supabase:', error.message);
    }
}

module.exports = {
    supabase,
    supabaseAdmin
};
