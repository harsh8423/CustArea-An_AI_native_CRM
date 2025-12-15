import { query } from "../db";
import { v4 as uuidv4 } from "uuid";

export type EndUser = {
    id: string;
    site_id: string;
    external_id: string | null;
    email: string | null;
    phone: string | null;
    metadata: any;
};

export async function findOrCreateEndUser(siteId: string, externalId: string): Promise<EndUser> {
    const { rows } = await query<EndUser>(
        "SELECT * FROM end_users WHERE site_id = $1 AND external_id = $2",
        [siteId, externalId]
    );
    if (rows[0]) return rows[0];

    const id = uuidv4();
    const insert = await query<EndUser>(
        `INSERT INTO end_users (id, site_id, external_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
        [id, siteId, externalId]
    );
    return insert.rows[0];
}

export async function updateEndUserEmailPhone(
    siteId: string,
    endUserId: string,
    email?: string,
    phone?: string
) {
    await query(
        `UPDATE end_users
     SET email = COALESCE($3, email),
         phone = COALESCE($4, phone),
         updated_at = NOW()
     WHERE id = $1 AND site_id = $2`,
        [endUserId, siteId, email || null, phone || null]
    );
}
