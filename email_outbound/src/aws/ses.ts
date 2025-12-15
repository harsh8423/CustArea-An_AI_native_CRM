import { SESv2Client } from "@aws-sdk/client-sesv2";
import dotenv from 'dotenv';

dotenv.config();

export const sesClient = new SESv2Client({
    region: process.env.AWS_REGION || "us-west-2",
    // credentials are taken from env/role automatically
});
