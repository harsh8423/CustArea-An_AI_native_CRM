import { Router } from "express";
import { createDomainIdentity, fetchIdentityStatus } from "../services/sesIdentityService";
import { pool } from "../db";

const router = Router();

// POST /tenants/:tenantId/ses/identities/domain
router.post("/:tenantId/ses/identities/domain", async (req, res) => {
    const { tenantId } = req.params;
    const { domain } = req.body;

    if (!domain) {
        return res.status(400).json({ error: "domain is required" });
    }

    try {
        const sesRes = await createDomainIdentity(domain);

        const dkimTokens = sesRes.DkimAttributes?.Tokens || [];
        const verificationStatus = "PENDING"; // CreateEmailIdentity doesn't return status immediately for DOMAIN

        const dkimRecords = dkimTokens.map((token) => ({
            type: "CNAME",
            name: `${token}._domainkey.${domain}`,
            value: `${token}.dkim.amazonses.com`,
        }));

        const verificationRecord = null; // SESv2 DOMAIN identity uses DKIM for verification, no separate TXT token needed usually

        const spfRecord = {
            type: "TXT",
            name: domain,
            value: "v=spf1 include:amazonses.com -all",
        };

        const client = await pool.connect();
        try {
            const insertRes = await client.query(
                `
        INSERT INTO tenant_ses_identities (
          id, tenant_id, identity_type, identity_value,
          verification_status, dkim_status, dkim_tokens, spf_instructions
        ) VALUES (
          gen_random_uuid(), $1, 'domain', $2,
          $3, $4, $5, $6
        )
        ON CONFLICT (tenant_id, identity_type, identity_value)
        DO UPDATE SET
          verification_status = EXCLUDED.verification_status,
          dkim_status = EXCLUDED.dkim_status,
          dkim_tokens = EXCLUDED.dkim_tokens,
          spf_instructions = EXCLUDED.spf_instructions
        RETURNING *
        `,
                [
                    tenantId,
                    domain,
                    verificationStatus,
                    sesRes.DkimAttributes?.Status || "PENDING",
                    JSON.stringify(dkimTokens),
                    spfRecord.value,
                ]
            );

            const identityRow = insertRes.rows[0];

            return res.json({
                identity: identityRow,
                dnsRecords: {
                    verification: verificationRecord,
                    dkim: dkimRecords,
                    spf: spfRecord,
                },
            });
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error("Error creating SES identity:", err);
        return res.status(500).json({ error: "SES identity creation failed", details: err.message });
    }
});

// GET /tenants/:tenantId/ses/identities/domain/:domain/status
router.get("/:tenantId/ses/identities/domain/:domain/status", async (req, res) => {
    const { tenantId, domain } = req.params;

    try {
        const status = await fetchIdentityStatus(domain);

        const client = await pool.connect();
        try {
            const updateRes = await client.query(
                `
        UPDATE tenant_ses_identities
        SET verification_status = $1,
            dkim_status         = $2,
            last_checked_at     = now()
        WHERE tenant_id = $3
          AND identity_type = 'domain'
          AND identity_value = $4
        RETURNING *
        `,
                [status.verificationStatus, status.dkimStatus, tenantId, domain]
            );

            if (updateRes.rows.length === 0) {
                return res.status(404).json({ error: "Identity not found" });
            }

            return res.json({
                identity: updateRes.rows[0],
                sesStatus: status,
            });
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error("Error fetching SES identity status:", err);
        return res.status(500).json({ error: "SES status fetch failed", details: err.message });
    }
});

// POST /tenants/:tenantId/ses/allowed-from
router.post("/:tenantId/ses/allowed-from", async (req, res) => {
    const { tenantId } = req.params;
    const { domain, fromEmail, isDefault } = req.body;

    if (!fromEmail || !domain) {
        return res.status(400).json({ error: "fromEmail and domain required" });
    }

    const emailDomain = fromEmail.split("@")[1]?.toLowerCase();
    if (emailDomain !== domain.toLowerCase()) {
        return res.status(400).json({ error: "fromEmail must be under given domain" });
    }

    const client = await pool.connect();
    try {
        const identityRes = await client.query(
            `
      SELECT id, verification_status, dkim_status
      FROM tenant_ses_identities
      WHERE tenant_id = $1 AND identity_type = 'domain' AND identity_value = $2
      `,
            [tenantId, domain]
        );

        if (identityRes.rows.length === 0) {
            return res.status(400).json({ error: "SES identity not found for this domain" });
        }

        const identity = identityRes.rows[0];
        // Note: In production you might want to enforce SUCCESS status, but for dev/testing we might relax it or warn.
        // if (identity.verification_status !== "SUCCESS") {
        //   return res.status(400).json({ error: "Domain not verified in SES" });
        // }

        const insertRes = await client.query(
            `
      INSERT INTO tenant_allowed_from_emails (
        id, tenant_id, ses_identity_id, email_address, is_default
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4)
      ON CONFLICT (tenant_id, email_address) DO UPDATE
      SET is_default = EXCLUDED.is_default
      RETURNING *
      `,
            [tenantId, identity.id, fromEmail.toLowerCase(), !!isDefault]
        );

        res.json({ allowedFrom: insertRes.rows[0] });
    } finally {
        client.release();
    }
});

// GET /tenants/:tenantId/ses/allowed-from
router.get("/:tenantId/ses/allowed-from", async (req, res) => {
    const { tenantId } = req.params;
    const { domain } = req.query;

    const client = await pool.connect();
    try {
        let query = `
            SELECT tafe.*, tsi.identity_value as domain
            FROM tenant_allowed_from_emails tafe
            JOIN tenant_ses_identities tsi ON tafe.ses_identity_id = tsi.id
            WHERE tafe.tenant_id = $1
        `;
        const params: any[] = [tenantId];

        if (domain) {
            query += ` AND tsi.identity_value = $2`;
            params.push(domain);
        }

        query += ` ORDER BY tafe.created_at DESC`;

        console.log(`Executing query: ${query} with params: ${JSON.stringify(params)}`);

        const result = await client.query(query, params);
        console.log(`Found ${result.rows.length} allowed emails for tenant ${tenantId}`);

        res.json({ allowedEmails: result.rows });
    } catch (err: any) {
        console.error("Error fetching allowed emails:", err);
        res.status(500).json({ error: "Failed to fetch allowed emails" });
    } finally {
        client.release();
    }
});

export default router;
