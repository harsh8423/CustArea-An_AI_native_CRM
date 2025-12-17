// index.js - Inbound Email Lambda with Omnichannel Integration
const AWS = require("aws-sdk");
const { simpleParser } = require("mailparser");
const { Pool } = require("pg");

const s3 = new AWS.S3();

const RAW_BUCKET = process.env.RAW_BUCKET;
const RAW_PREFIX = process.env.RAW_PREFIX || "";
const ATTACHMENTS_BUCKET = process.env.ATTACHMENTS_BUCKET || RAW_BUCKET;
const ATTACHMENTS_PREFIX = process.env.ATTACHMENTS_PREFIX || "attachments/";

if (!RAW_BUCKET) {
  console.warn("RAW_BUCKET env var missing");
}

const connectionString = process.env.DB_URL;
if (!connectionString) {
  console.error("DB_URL is not set in environment variables");
}

const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Helper to map address list
function mapAddressList(list) {
  if (!list || !list.value) return [];
  return list.value.map((a) => ({
    name: a.name || null,
    email: (a.address || "").toLowerCase(),
  }));
}

// Extract email threading headers
function extractThreadingHeaders(parsed) {
  const headers = parsed.headers || new Map();
  return {
    messageIdHeader: headers.get('message-id') || null,
    inReplyTo: headers.get('in-reply-to') || null,
    references: headers.get('references') || null,
  };
}

exports.handler = async (event) => {
  console.log("SES event received");

  // Quick connectivity test
  try {
    console.log("Testing DB connectivity with SELECT now()");
    const testClient = await pool.connect();
    try {
      const res = await testClient.query("SELECT now() as now");
      console.log("DB connectivity test OK:", res.rows[0]);
    } finally {
      testClient.release();
    }
  } catch (err) {
    console.error("DB connectivity test FAILED:", err && err.stack ? err.stack : err);
    throw new Error("DB connectivity failed; check DB_URL, network, and SG/VPC.");
  }

  const record = event.Records && event.Records[0];
  if (!record || !record.ses) {
    console.error("No SES record found");
    return;
  }

  const ses = record.ses;
  const mail = ses.mail;
  const receipt = ses.receipt;
  const messageId = mail.messageId;

  if (!messageId) {
    console.error("No messageId in SES mail object");
    return;
  }

  const s3Key = `${RAW_PREFIX}${messageId}`;
  console.log(`Fetching raw email from s3://${RAW_BUCKET}/${s3Key}`);

  let rawEmail;
  try {
    const obj = await s3
      .getObject({
        Bucket: RAW_BUCKET,
        Key: s3Key,
      })
      .promise();
    rawEmail = obj.Body;
  } catch (err) {
    console.error("Failed to get raw email from S3", err && err.stack ? err.stack : err);
    throw err;
  }

  let parsed;
  try {
    parsed = await simpleParser(rawEmail);
  } catch (err) {
    console.error("Failed to parse raw email", err && err.stack ? err.stack : err);
    throw err;
  }

  const toList = mapAddressList(parsed.to);
  const toAddresses = toList.map((a) => a.email);
  if (!toAddresses.length) {
    console.error("No To addresses found; dropping email");
    return;
  }

  const inboundAddress = toAddresses[0];
  console.log("Inbound address:", inboundAddress);

  // Parse tenant ID from inbound address: tenant_UUID+mailbox@domain
  const [localPart] = inboundAddress.split("@");
  let tenantId = null;
  let mailboxKey = null;

  try {
    const [tenantPart, mailboxPart] = localPart.split("+");
    const m = tenantPart && tenantPart.match(/^tenant_(.+)$/);
    if (m) {
      tenantId = m[1];
    }
    mailboxKey = mailboxPart || null;
  } catch (err) {
    console.error("Error parsing tenant/mailbox from localPart", localPart, err);
  }

  if (!tenantId) {
    console.error("Could not extract tenantId from inboundAddress", inboundAddress);
    return;
  }

  const fromList = mapAddressList(parsed.from);
  const ccList = mapAddressList(parsed.cc);
  const bccList = mapAddressList(parsed.bcc);
  const senderEmail = fromList[0]?.email || null;
  const senderName = fromList[0]?.name || null;

  const subject = parsed.subject || "";
  const textBody = parsed.text || "";
  const htmlBody = parsed.html || "";
  const threadingHeaders = extractThreadingHeaders(parsed);

  const sesMetadata = {
    timestamp: mail.timestamp,
    source: mail.source,
    destination: mail.destination,
    headers: mail.headers,
    spamVerdict: receipt.spamVerdict,
    dkimVerdict: receipt.dkimVerdict,
    spfVerdict: receipt.spfVerdict,
    virusVerdict: receipt.virusVerdict,
  };

  console.log("Email parsed; subject:", subject, "from:", senderEmail);

  // Upload attachments to S3
  const attachments = parsed.attachments || [];
  const attachmentRecords = [];

  try {
    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      const safeFilename = att.filename || `attachment-${i + 1}`;
      const attKey = `${ATTACHMENTS_PREFIX}${tenantId}/${messageId}/${safeFilename}`;

      await s3
        .putObject({
          Bucket: ATTACHMENTS_BUCKET,
          Key: attKey,
          Body: att.content,
          ContentType: att.contentType,
        })
        .promise();

      attachmentRecords.push({
        filename: safeFilename,
        contentType: att.contentType,
        size: att.size,
        cid: att.cid || null,
        isInline: !!att.cid,
        s3Key: attKey,
      });

      console.log(`Uploaded attachment to s3://${ATTACHMENTS_BUCKET}/${attKey}`);
    }
  } catch (err) {
    console.error("Attachment upload failed:", err);
    throw err;
  }

  // Database operations with omnichannel integration
  let client;
  try {
    client = await pool.connect();
    console.log("Got DB client");

    await client.query("BEGIN");

    // 1. Idempotency check - skip if already processed
    const existing = await client.query(
      "SELECT id FROM inbound_emails WHERE tenant_id = $1 AND raw_message_id = $2",
      [tenantId, messageId]
    );
    if (existing.rows.length > 0) {
      console.log(`Email already processed (tenant=${tenantId}, messageId=${messageId})`);
      await client.query("COMMIT");
      return;
    }

    // 2. Find or create contact by email
    let contactId = null;
    if (senderEmail) {
      const contactResult = await client.query(
        `SELECT id FROM contacts WHERE tenant_id = $1 AND email = $2`,
        [tenantId, senderEmail]
      );

      if (contactResult.rows.length > 0) {
        contactId = contactResult.rows[0].id;
        console.log("Found existing contact:", contactId);
      } else {
        // Create new contact
        const newContact = await client.query(
          `INSERT INTO contacts (tenant_id, email, name, source)
           VALUES ($1, $2, $3, 'email')
           RETURNING id`,
          [tenantId, senderEmail, senderName]
        );
        contactId = newContact.rows[0].id;
        console.log("Created new contact:", contactId);
      }
    }

    // 3. Find or create conversation for this email thread
    let conversationId = null;
    
    // Try to find existing open conversation by email (channel_contact_id)
    const existingConv = await client.query(
      `SELECT id FROM conversations 
       WHERE tenant_id = $1 AND channel = 'email' AND channel_contact_id = $2 AND status != 'closed'
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, senderEmail]
    );

    if (existingConv.rows.length > 0) {
      conversationId = existingConv.rows[0].id;
      console.log("Found existing conversation:", conversationId);
      
      // Update last_message_at
      await client.query(
        `UPDATE conversations SET last_message_at = now(), updated_at = now() WHERE id = $1`,
        [conversationId]
      );
    } else {
      // Create new conversation
      const newConv = await client.query(
        `INSERT INTO conversations (
           tenant_id, contact_id, channel, channel_contact_id, status, subject, ai_enabled
         ) VALUES ($1, $2, 'email', $3, 'open', $4, true)
         RETURNING id`,
        [tenantId, contactId, senderEmail, subject]
      );
      conversationId = newConv.rows[0].id;
      console.log("Created new conversation:", conversationId);
    }

    // 4. Insert message into canonical messages table
    const msgResult = await client.query(
      `INSERT INTO messages (
         tenant_id, conversation_id, direction, role, channel,
         content_text, content_html, provider, provider_message_id, status
       ) VALUES ($1, $2, 'inbound', 'user', 'email', $3, $4, 'ses', $5, 'received')
       RETURNING id`,
      [tenantId, conversationId, textBody, htmlBody, messageId]
    );
    const msgId = msgResult.rows[0].id;
    console.log("Created message:", msgId);

    // 5. Insert email-specific metadata
    await client.query(
      `INSERT INTO message_email_metadata (
         message_id, from_address, to_addresses, cc_addresses, bcc_addresses,
         ses_message_id, raw_message_id, s3_key, message_id_header, in_reply_to, references_header, ses_metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        msgId,
        senderEmail,
        JSON.stringify(toList),
        JSON.stringify(ccList),
        JSON.stringify(bccList),
        messageId,
        messageId,
        s3Key,
        threadingHeaders.messageIdHeader,
        threadingHeaders.inReplyTo,
        threadingHeaders.references,
        JSON.stringify(sesMetadata),
      ]
    );

    // 6. Insert attachments into canonical attachments table
    for (const attRec of attachmentRecords) {
      await client.query(
        `INSERT INTO attachments (
           tenant_id, message_id, filename, content_type, size_bytes,
           storage_type, storage_key, cid, is_inline
         ) VALUES ($1, $2, $3, $4, $5, 's3', $6, $7, $8)`,
        [
          tenantId,
          msgId,
          attRec.filename,
          attRec.contentType,
          attRec.size,
          attRec.s3Key,
          attRec.cid,
          attRec.isInline,
        ]
      );
    }

    // 7. Also insert into legacy inbound_emails table for backwards compatibility
    const insertEmailRes = await client.query(
      `INSERT INTO inbound_emails (
         tenant_id, mailbox_key, inbound_address, raw_message_id, s3_key,
         from_json, to_json, cc_json, bcc_json, subject, text_body, html_body, ses_metadata,
         conversation_id, message_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        tenantId,
        mailboxKey,
        inboundAddress,
        messageId,
        s3Key,
        JSON.stringify(fromList),
        JSON.stringify(toList),
        JSON.stringify(ccList),
        JSON.stringify(bccList),
        subject,
        textBody,
        htmlBody,
        JSON.stringify(sesMetadata),
        conversationId,
        msgId,
      ]
    );
    const inboundEmailId = insertEmailRes.rows[0].id;

    // 8. Insert legacy attachments
    for (const attRec of attachmentRecords) {
      await client.query(
        `INSERT INTO inbound_attachments (email_id, filename, content_type, size, cid, s3_key)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [inboundEmailId, attRec.filename, attRec.contentType, attRec.size, attRec.cid, attRec.s3Key]
      );
    }

    await client.query("COMMIT");
    
    console.log(`Email processed successfully:
      - inboundEmailId: ${inboundEmailId}
      - conversationId: ${conversationId}
      - messageId: ${msgId}
      - contactId: ${contactId}
      - attachments: ${attachmentRecords.length}`);

    // 9. Queue message for AI processing (call backend API)
    const backendUrl = process.env.BACKEND_API_URL;
    if (backendUrl) {
      try {
        const response = await fetch(`${backendUrl}/api/ai/queue/${msgId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            conversationId,
            channel: 'email'
          })
        });
        const result = await response.json();
        console.log(`AI queue result: queued=${result.queued}, reason=${result.reason || 'success'}`);
      } catch (aiErr) {
        console.warn('Failed to queue for AI processing:', aiErr.message);
        // Don't throw - email is already saved, AI queueing is optional
      }
    } else {
      console.log('BACKEND_API_URL not set, skipping AI queue');
    }

  } catch (err) {
    console.error("DB operation failed:", err);
    try {
      if (client) await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error("Rollback failed:", rbErr);
    }
    throw err;
  } finally {
    if (client) client.release();
  }
};

