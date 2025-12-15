import { query } from "../db";
import { v4 as uuidv4 } from "uuid";

export async function insertMessage(
    siteId: string,
    conversationId: string,
    role: "user" | "assistant" | "system",
    content: string,
    metadata: any = {}
) {
    const id = uuidv4();
    await query(
        `INSERT INTO messages (id, conversation_id, site_id, role, content, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, conversationId, siteId, role, content, metadata]
    );
}

export type MessageRecord = {
    id: string;
    role: string;
    content: string;
    created_at: string;
};

export async function getRecentMessages(
    siteId: string,
    conversationId: string,
    limit: number = 20
): Promise<MessageRecord[]> {
    const { rows } = await query<MessageRecord>(
        `SELECT id, role, content, created_at
       FROM messages
      WHERE site_id = $1 AND conversation_id = $2
      ORDER BY created_at DESC
      LIMIT $3`,
        [siteId, conversationId, limit]
    );
    return rows.reverse(); // oldest first
}
