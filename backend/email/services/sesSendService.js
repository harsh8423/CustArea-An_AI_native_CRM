const { SendEmailCommand } = require("@aws-sdk/client-sesv2");
const { sesClient } = require("../../config/ses");
const { pool } = require("../../config/db");

/**
 * Send an email on behalf of a tenant
 * @param {Object} input
 * @param {string} input.tenantId
 * @param {string} [input.fromEmail] - Optional, will use default if not provided
 * @param {string} input.to
 * @param {string} input.subject
 * @param {string} [input.html]
 * @param {string} [input.text]
 * @param {string} [input.replyTo]
 */
async function sendTenantEmail(input) {
    const { tenantId, fromEmail, to, subject, html, text, replyTo } = input;

    const client = await pool.connect();
    try {
        let effectiveFromEmail = fromEmail;

        // If no fromEmail provided, get the default or first allowed email
        if (!effectiveFromEmail) {
            const res = await client.query(
                `SELECT email_address
                 FROM tenant_allowed_from_emails
                 WHERE tenant_id = $1
                 ORDER BY is_default DESC, created_at ASC
                 LIMIT 1`,
                [tenantId]
            );

            if (res.rows.length === 0) {
                throw new Error("No allowed from emails configured for tenant");
            }

            effectiveFromEmail = res.rows[0].email_address;
        }

        if (!effectiveFromEmail) {
            throw new Error("Could not determine fromEmail");
        }

        // Build SES message
        const message = {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: {},
        };
        if (html) {
            message.Body.Html = { Data: html, Charset: "UTF-8" };
        }
        if (text) {
            message.Body.Text = { Data: text, Charset: "UTF-8" };
        }

        const sesParams = {
            Destination: { ToAddresses: [to] },
            FromEmailAddress: effectiveFromEmail,
            Content: {
                Simple: message,
            },
        };

        if (replyTo) {
            sesParams.ReplyToAddresses = [replyTo];
        }

        // Send via SES
        const sendRes = await sesClient.send(new SendEmailCommand(sesParams));

        return {
            sesMessageId: sendRes.MessageId,
            effectiveFromEmail,
        };
    } catch (err) {
        console.error("SES Send Error:", err);
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    sendTenantEmail
};
