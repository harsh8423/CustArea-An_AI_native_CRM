import jwt from "jsonwebtoken";
import { CONFIG } from "./config";
import crypto from "crypto";

export type WidgetTokenPayload = {
    jti: string;
    siteId: string;
    externalId: string;
    ipHash?: string;
    iat: number;
    exp: number;
};

export function signWidgetToken(payload: Omit<WidgetTokenPayload, "iat" | "exp" | "jti">): string {
    const now = Math.floor(Date.now() / 1000);
    const jti = crypto.randomUUID();

    const fullPayload: WidgetTokenPayload = {
        ...payload,
        jti,
        iat: now,
        exp: now + CONFIG.jwtExpirySeconds,
    };

    return jwt.sign(fullPayload, CONFIG.jwtSecret);
}

export function verifyWidgetToken(token: string): WidgetTokenPayload {
    return jwt.verify(token, CONFIG.jwtSecret) as WidgetTokenPayload;
}

export function hashIp(ip: string | undefined): string | undefined {
    if (!ip) return undefined;
    return crypto.createHash("sha256").update(ip).digest("hex");
}
