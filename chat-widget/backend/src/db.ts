import { Pool, QueryResultRow } from "pg";
import { CONFIG } from "./config";

export const pool = new Pool({
    connectionString: CONFIG.databaseUrl,
});

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
    return pool.query<T>(text, params);
}
