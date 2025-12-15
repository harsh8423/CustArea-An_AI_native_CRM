import { Router, Response } from "express";
import { WidgetRequest, widgetAuth } from "../middleware/widgetAuth";
import { rateLimit } from "../middleware/rateLimit";
import { findOrCreateEndUser } from "../services/userService";
import { findOrCreateConversation } from "../services/conversationService";
import { insertMessage, getRecentMessages } from "../services/messageService";
import { generateReply } from "../services/llmService";

const router = Router();

router.post(
    "/widget/chat",
    rateLimit("chat"),
    widgetAuth,
    async (req: WidgetRequest, res: Response) => {
        const { message, conversationId, metadata } = req.body || {};
        if (!message || typeof message !== "string") {
            return res.status(400).json({ error: "message required" });
        }

        const tokenPayload = req.widgetToken!;
        const site = req.site!;
        const siteId = tokenPayload.siteId;
        const externalId = tokenPayload.externalId;

        // Resolve end user
        const endUser = await findOrCreateEndUser(siteId, externalId);

        // Resolve conversation
        const convo = await findOrCreateConversation(siteId, endUser.id, conversationId);

        // Store user message
        await insertMessage(siteId, convo.id, "user", message, metadata || {});

        // Fetch recent history
        const history = await getRecentMessages(siteId, convo.id, 20);

        // Generate LLM reply
        const replyText = await generateReply(siteId, convo.id, history, message);

        // Store assistant message
        await insertMessage(siteId, convo.id, "assistant", replyText, {});

        return res.json({
            conversationId: convo.id,
            reply: replyText,
            endUser: {
                id: endUser.id,
                email: endUser.email,
                phone: endUser.phone,
            },
        });
    }
);

export default router;
