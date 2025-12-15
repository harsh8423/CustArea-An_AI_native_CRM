import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { sesClient } from "../aws/ses";
import { pool } from "../db";

interface SendTenantEmailInput {
    tenantId: string;
    fromEmail?: string;
    to: string;
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
    headers?: Record<string, string>;
}

export async function sendTenantEmail(input: SendTenantEmailInput) {
    const { tenantId, fromEmail, to, subject, html, text, replyTo, headers } = input;

    const client = await pool.connect();
    try {
        let effectiveFromEmail = fromEmail;

        if (!effectiveFromEmail) {
            const res = await client.query(
                `
        SELECT email_address
        FROM tenant_allowed_from_emails
        WHERE tenant_id = $1
        ORDER BY is_default DESC, created_at ASC
        LIMIT 1
        `,
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

        const outboundInsert = await client.query(
            `
      INSERT INTO outbound_emails (
        tenant_id, to_email, from_email, subject, body_html, body_text, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING id
      `,
            [tenantId, to.toLowerCase(), effectiveFromEmail.toLowerCase(), subject, html || null, text || null]
        );
        const outboundId = outboundInsert.rows[0].id;

        const message: any = {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: {},
        };
        if (html) {
            message.Body.Html = { Data: html, Charset: "UTF-8" };
        }
        if (text) {
            message.Body.Text = { Data: text, Charset: "UTF-8" };
        }

        const sesParams: any = {
            Destination: { ToAddresses: [to] },
            FromEmailAddress: effectiveFromEmail,
            Content: {
                Simple: message,
            },
        };

        if (replyTo) {
            sesParams.ReplyToAddresses = [replyTo];
        }

        const sendRes = await sesClient.send(new SendEmailCommand(sesParams));

        await client.query(
            `
      UPDATE outbound_emails
      SET status = 'sent',
          ses_message_id = $1,
          sent_at = now()
      WHERE id = $2
      `,
            [sendRes.MessageId, outboundId]
        );

        return {
            outboundId,
            sesMessageId: sendRes.MessageId,
        };
    } catch (err: any) {
        console.error("SES Send Error Details:", JSON.stringify(err, null, 2));
        throw err;
    } finally {
        client.release();
    }
}
