import { Router } from "express";
import { sendTenantEmail } from "../services/sesSendService";

const router = Router();

// POST /tenants/:tenantId/email/send
router.post("/:tenantId/email/send", async (req, res) => {
    const { tenantId } = req.params;
    const { to, fromEmail, subject, html, text, replyTo } = req.body;

    if (!to || !subject || (!html && !text)) {
        return res.status(400).json({ error: "to, subject and html or text required" });
    }

    try {
        const result = await sendTenantEmail({
            tenantId,
            fromEmail,
            to,
            subject,
            html,
            text,
            replyTo,
        });

        return res.json({ ok: true, ...result });
    } catch (err: any) {
        console.error("Error sending tenant email:", err);
        return res.status(500).json({ error: "Send failed", details: err.message });
    }
});

export default router;
