import { query } from "../db";
import { v4 as uuidv4 } from "uuid";

export type Conversation = {
    id: string;
    site_id: string;
    end_user_id: string;
    status: string;
};

export async function findOrCreateConversation(
    siteId: string,
    endUserId: string,
    conversationId?: string
): Promise<Conversation> {
    if (conversationId) {
        const { rows } = await query<Conversation>(
            "SELECT * FROM conversations WHERE id = $1 AND site_id = $2 AND end_user_id = $3",
            [conversationId, siteId, endUserId]
        );
        if (rows[0]) return rows[0];
    }

    // Try last open conversation
    const { rows } = await query<Conversation>(
        `SELECT * FROM conversations
     WHERE site_id = $1 AND end_user_id = $2 AND status = 'open'
     ORDER BY created_at DESC
     LIMIT 1`,
        [siteId, endUserId]
    );

    if (rows[0]) return rows[0];

    const id = uuidv4();
    const insert = await query<Conversation>(
        `INSERT INTO conversations (id, site_id, end_user_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
        [id, siteId, endUserId]
    );

    return insert.rows[0];
}
