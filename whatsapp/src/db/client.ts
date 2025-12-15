import { Pool } from 'pg';
import { config } from '../config/env';

if (!config.databaseUrl) {
    console.error('DATABASE_URL is missing');
    process.exit(1);
}

export const db = new Pool({
    connectionString: config.databaseUrl,
    ssl: {
        rejectUnauthorized: false // Required for Supabase/some cloud providers
    }
});

db.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});
