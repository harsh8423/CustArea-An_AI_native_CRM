const { 
    CreateEmailIdentityCommand, 
    GetEmailIdentityCommand 
} = require("@aws-sdk/client-sesv2");
const { sesClient } = require("../config/ses");

/**
 * Create a domain identity in SES with DKIM
 */
async function createDomainIdentity(domain) {
    const cmd = new CreateEmailIdentityCommand({
        EmailIdentity: domain,
        DkimSigningAttributes: {
            NextSigningKeyLength: "RSA_2048_BIT",
        },
    });

    const res = await sesClient.send(cmd);
    return res;
}

/**
 * Get identity details (for status check)
 */
async function getIdentity(domainOrEmail) {
    const cmd = new GetEmailIdentityCommand({
        EmailIdentity: domainOrEmail,
    });
    return await sesClient.send(cmd);
}

/**
 * Fetch verification and DKIM status from SES
 */
async function fetchIdentityStatus(domainOrEmail) {
    const res = await sesClient.send(
        new GetEmailIdentityCommand({ EmailIdentity: domainOrEmail })
    );

    return {
        verificationStatus: res.VerificationStatus,
        dkimStatus: res.DkimAttributes?.Status,
    };
}

module.exports = {
    createDomainIdentity,
    getIdentity,
    fetchIdentityStatus
};
