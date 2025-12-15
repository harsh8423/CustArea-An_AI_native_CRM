import {
    CreateEmailIdentityCommand,
    GetEmailIdentityCommand,
} from "@aws-sdk/client-sesv2";
import { sesClient } from "../aws/ses";

export async function createDomainIdentity(domain: string) {
    const cmd = new CreateEmailIdentityCommand({
        EmailIdentity: domain,
        DkimSigningAttributes: {
            NextSigningKeyLength: "RSA_2048_BIT",
        },
    });

    const res = await sesClient.send(cmd);
    return res;
}

export async function getIdentity(domainOrEmail: string) {
    const cmd = new GetEmailIdentityCommand({
        EmailIdentity: domainOrEmail,
    });
    return await sesClient.send(cmd);
}

export async function fetchIdentityStatus(domainOrEmail: string) {
    const res = await sesClient.send(
        new GetEmailIdentityCommand({ EmailIdentity: domainOrEmail })
    );

    return {
        verificationStatus: res.VerificationStatus,
        dkimStatus: res.DkimAttributes?.Status,
    };
}
