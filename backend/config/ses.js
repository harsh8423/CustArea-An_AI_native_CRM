const { SESv2Client } = require("@aws-sdk/client-sesv2");

const sesClient = new SESv2Client({
    region: process.env.AWS_REGION || "us-west-2",
    // credentials are taken from env/role automatically:
    // AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
});

module.exports = { sesClient };
