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
    const { tenantId, fromEmail, to, subject, html, text, replyTo, inReplyTo, references } = input;

    const client = await pool.connect();
    try {
        let effectiveFromEmail = fromEmail;

        // If fromEmail explicitly provided (e.g., campaign reply), use it directly
        // This allows forcing specific sender for campaign threading
        if (effectiveFromEmail) {
            console.log(`Using explicit FROM address: ${effectiveFromEmail}`);
        } else {
            // Fallback: get the default or first allowed email
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
        let sesParams;

        if (input.inReplyTo || input.references) {
             // USE RAW EMAIL for threading headers (In-Reply-To and/or References)
             const boundary = `----=_Part_${Math.random().toString(36).substring(2)}`;
             const rawMessage = buildRawEmail({
                 from: effectiveFromEmail,
                 to,
                 subject,
                 html,
                 text,
                 inReplyTo: input.inReplyTo,
                 references: input.references,
                 boundary
             });

             sesParams = {
                 Content: {
                     Raw: {
                         Data: Buffer.from(rawMessage)
                     }
                 }
             };

        } else {
             // Use Simple for standard emails
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

            sesParams = {
                Destination: { ToAddresses: [to] },
                FromEmailAddress: effectiveFromEmail,
                Content: {
                    Simple: message,
                },
            };
        }

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

/**
 * Build Raw MIME Email
 */
function buildRawEmail({ from, to, subject, html, text, inReplyTo, references, boundary }) {
    const nl = '\r\n';
    let raw = '';
    
    // Headers
    raw += `From: ${from}${nl}`;
    raw += `To: ${to}${nl}`;
    raw += `Subject: ${subject}${nl}`;
    
    // Add threading headers for proper Gmail/Outlook threading
    if (inReplyTo) {
        raw += `In-Reply-To: ${inReplyTo}${nl}`;
    }
    
    // References header preserves entire thread chain
    if (references) {
        raw += `References: ${references}${nl}`;
    } else if (inReplyTo) {
        // Fallback: if no references but we have inReplyTo, use it
        raw += `References: ${inReplyTo}${nl}`;
    }
    
    raw += `MIME-Version: 1.0${nl}`;
    raw += `Content-Type: multipart/alternative; boundary="${boundary}"${nl}`;
    raw += nl;
    
    // Text Part
    if (text) {
        raw += `--${boundary}${nl}`;
        raw += `Content-Type: text/plain; charset=UTF-8${nl}`;
        raw += `Content-Transfer-Encoding: 7bit${nl}`;
        raw += nl;
        raw += text + nl;
        raw += nl;
    }

    // HTML Part
    if (html) {
        raw += `--${boundary}${nl}`;
        raw += `Content-Type: text/html; charset=UTF-8${nl}`;
        raw += `Content-Transfer-Encoding: 7bit${nl}`;
        raw += nl;
        raw += html + nl;
        raw += nl;
    }
    
    raw += `--${boundary}--`;
    return raw;
}

module.exports = {
    sendTenantEmail
};
