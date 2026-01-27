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
  console.log("=== SES Lambda Triggered ===");
  console.log("Event received:", JSON.stringify(event, null, 2));
  
  // Validate environment configuration
  if (!RAW_BUCKET) {
    console.error("CRITICAL: RAW_BUCKET environment variable is missing");
    throw new Error("Missing RAW_BUCKET configuration");
  }
  if (!connectionString) {
    console.error("CRITICAL: DB_URL environment variable is missing");
    throw new Error("Missing DB_URL configuration");
  }
  
  console.log("Environment check: RAW_BUCKET =", RAW_BUCKET);
  console.log("Environment check: DB_URL = [SET]");
  console.log("Environment check: ATTACHMENTS_BUCKET =", ATTACHMENTS_BUCKET);
  console.log("Environment check: BACKEND_API_URL =", process.env.BACKEND_API_URL || "[NOT SET]");

  // Quick connectivity test
  try {
    // console.log("Testing DB connectivity with SELECT now()");
    // const testClient = await pool.connect();
    // try {
    //   const res = await testClient.query("SELECT now() as now");
    //   console.log("DB connectivity test OK:", res.rows[0]);
    // } finally {
    //   testClient.release();
    // }
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
  const ccList = mapAddressList(parsed.cc);
  const bccList = mapAddressList(parsed.bcc);
  const toAddresses = toList.map((a) => a.email);
  
  // Use the actual recipient from SES event if available (reliable for forwarded emails)
  // otherwise fallback to the To header
  const sesRecipients = event.Records[0].ses.receipt.recipients;
  const inboundAddress = (sesRecipients && sesRecipients.length > 0) 
    ? sesRecipients[0] 
    : (toAddresses.length > 0 ? toAddresses[0] : null);

  if (!inboundAddress) {
    console.error("No inbound address found (checked SES recipients and To header); dropping email");
    return;
  }

  console.log("Inbound address:", inboundAddress);

  const fromList = mapAddressList(parsed.from);
  const senderEmail = fromList[0]?.email || null;
  const senderName = fromList[0]?.name || null;
  const subject = parsed.subject || "";
  const textBody = parsed.text || "";
  const htmlBody = parsed.html || "";
  
    // --- NEW LOGIC START ---
    
    let client;
    try {
      client = await pool.connect();
      
      let tenantId = null;
      let mailboxKey = null;
      let isForwarded = false;
      let actualSenderEmail = senderEmail;
      let actualSenderName = senderName;
      let unknownReason = null;

      // Strategy: Determine if Forwarded or Direct
      // We assume the internal inbound domain is used for forwarding.
      // Pattern: tenant_<uuid>+<optional_key>@...
      const [localPart, domain] = inboundAddress.split("@");
      const tenantMatch = localPart.match(/^tenant_([a-f0-9\-]+)(?:\+(.*))?$/);

      if (tenantMatch) {
        // === Case 1: Forwarded Email ===
        // Format: tenant_<uuid>+<mailbox_key>@inbound.custarea.com
        isForwarded = true;
        const potentialTenantId = tenantMatch[1];
        mailboxKey = tenantMatch[2] || null;
        
        console.log(`Processing Forwarded Email for Potential Tenant: ${potentialTenantId}`);

        // Verify tenant exists
        const tenantCheck = await client.query(
          `SELECT id FROM tenants WHERE id = $1`,
          [potentialTenantId]
        );

        if (tenantCheck.rows.length > 0) {
          tenantId = tenantCheck.rows[0].id;
          
          // Verify if the email was sent to (or CC'd to) an allowed inbound address
          // We check if any of the To/CC addresses match an entry in allowed_inbound_emails for this tenant.
          const recipients = [...toAddresses, ...ccList.map(a => a.email)];
          
          const allowedCheck = await client.query(
            `SELECT email_address FROM allowed_inbound_emails 
             WHERE tenant_id = $1 AND email_address = ANY($2::text[]) AND is_active = true`,
            [tenantId, recipients]
          );
          
          if (allowedCheck.rows.length > 0) {
             console.log(`Verified forwarding via allowed address: ${allowedCheck.rows[0].email_address}`);
          } else {
             console.warn(`No allowed inbound address found in To/CC headers for tenant ${tenantId}. Proceeding based on valid tenant ID in address.`);
             // We proceed because the unique tenant ID in the address is a strong signal of intent.
          }

        } else {
          unknownReason = 'tenant_id_not_found';
          console.warn(`Tenant ID ${potentialTenantId} from address not found in DB.`);
        }
        
      } else {
        // === Case 2: Direct SES Email ===
        // Format: support@custarea.com (or similar)
        
        // 1. Check allowed_inbound_emails (Exact Match)
        const allowedRes = await client.query(
          "SELECT tenant_id FROM allowed_inbound_emails WHERE email_address = $1 AND is_active = true",
          [inboundAddress]
        );
        
        if (allowedRes.rows.length > 0) {
          tenantId = allowedRes.rows[0].tenant_id;
          console.log(`Identified Tenant ${tenantId} via Allowed Inbound Email ${inboundAddress}`);
        } else {
          // 2. Fallback: Check SES Identities (Domain Match)
          // "if the domain is not @inbound.custarea.com then it must be a ses identity"
          
          // Check exact identity first (e.g. email identity)
          const identityRes = await client.query(
            "SELECT tenant_id FROM tenant_ses_identities WHERE identity_value = $1 AND verification_status = 'SUCCESS'",
            [inboundAddress]
          );
          
          if (identityRes.rows.length > 0) {
            tenantId = identityRes.rows[0].tenant_id;
            console.log(`Identified Tenant ${tenantId} via SES Identity ${inboundAddress}`);
          } else {
            // Check domain identity
            const domainOnly = inboundAddress.split('@')[1];
            const domainRes = await client.query(
                "SELECT tenant_id FROM tenant_ses_identities WHERE identity_value = $1 AND identity_type = 'domain' AND verification_status = 'SUCCESS'",
                [domainOnly]
            );
            
            if (domainRes.rows.length > 0) {
                 tenantId = domainRes.rows[0].tenant_id;
                 console.log(`Identified Tenant ${tenantId} via SES Domain Identity ${domainOnly}`);
            } else {
                 console.warn(`No tenant found for inbound address ${inboundAddress}`);
                 unknownReason = 'no_matching_tenant_or_identity';
            }
          }
        }
      }

      // Handle Unknown / Unresolved Tenant
      if (!tenantId) {
        console.log("Saving to unknown_emails table...");
        await client.query(
          `INSERT INTO unknown_emails (
             inbound_address, from_address, subject, text_body, html_body, raw_message_id, s3_key, reason
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [inboundAddress, senderEmail, subject, textBody, htmlBody, messageId, s3Key, unknownReason || 'unknown']
        );
        return; // Stop processing
      }

      // Determine Actual Sender
      if (isForwarded) {
        // Strategy for extracting original sender from forwarded email:
        // 1. Reply-To header (Standard for many forwarders)
        // 2. X-Forwarded-For (Sometimes present)
        // 3. Body Parsing (Last resort, looking for "From: <email>")
        
        const replyToList = mapAddressList(parsed.replyTo);
        if (replyToList.length > 0) {
          actualSenderEmail = replyToList[0].email;
          actualSenderName = replyToList[0].name || actualSenderName;
          console.log(`Forwarded: Using Reply-To as actual sender: ${actualSenderEmail}`);
        } else {
          // Try body parsing
          // Look for "From: Name <email>" or "From: email"
          const fromMatch = textBody.match(/From:\s*(?:["']?([^"<']+)["']?\s*)?<([^>]+)>/i) || textBody.match(/From:\s*([^\s<]+@[^\s<]+)/i);
          
          if (fromMatch) {
             if (fromMatch[2]) {
                 // Format: From: Name <email>
                 actualSenderName = fromMatch[1] ? fromMatch[1].trim() : actualSenderName;
                 actualSenderEmail = fromMatch[2].trim();
             } else if (fromMatch[1]) {
                 // Format: From: email
                 actualSenderEmail = fromMatch[1].trim();
             }
             console.log(`Forwarded: Extracted sender from body: ${actualSenderEmail}`);
          } else {
             console.warn("Forwarded: Could not determine actual sender from Reply-To or Body. Using forwarder as sender.");
          }
        }
      }

    // --- EXISTING LOGIC RESUMES (with tenantId and actualSenderEmail) ---
    
    const threadingHeaders = extractThreadingHeaders(parsed);
    // ccList and bccList moved to top
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

    await client.query("BEGIN");

    // 1. Idempotency check
    const existing = await client.query(
      "SELECT id FROM messages WHERE tenant_id = $1 AND provider_message_id = $2",
      [tenantId, messageId]
    );
    if (existing.rows.length > 0) {
      console.log(`Email already processed (tenant=${tenantId}, messageId=${messageId})`);
      await client.query("COMMIT");
      return;
    }

    // 2. Find or create contact (Using actualSenderEmail)
    let contactId = null;
    if (actualSenderEmail) {
      const contactResult = await client.query(
        `SELECT id FROM contacts WHERE tenant_id = $1 AND email = $2`,
        [tenantId, actualSenderEmail]
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
          [tenantId, actualSenderEmail, actualSenderName]
        );
        contactId = newContact.rows[0].id;
        console.log("Created new contact:", contactId);
      }
    }

    // 3. Find or create conversation
    let conversationId = null;
    
    // Try to find existing open conversation
    const existingConv = await client.query(
      `SELECT id FROM conversations 
       WHERE tenant_id = $1 AND channel = 'email' AND channel_contact_id = $2 AND status != 'closed'
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, actualSenderEmail]
    );

    if (existingConv.rows.length > 0) {
      conversationId = existingConv.rows[0].id;
      console.log("Found existing conversation:", conversationId);
      
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
        [tenantId, contactId, actualSenderEmail, subject]
      );
      conversationId = newConv.rows[0].id;
      console.log("Created new conversation:", conversationId);
    }

    // 4. Insert message
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
        actualSenderEmail,
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

    // 6. Insert attachments
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

    await client.query("COMMIT");
    
    console.log(`Email processed successfully:
      - conversationId: ${conversationId}
      - messageId: ${msgId}
      - contactId: ${contactId}
      - attachments: ${attachmentRecords.length}`);

    // 9. Queue message for AI processing
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

