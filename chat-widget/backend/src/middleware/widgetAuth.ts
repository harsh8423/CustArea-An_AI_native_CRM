import { Request, Response, NextFunction } from "express";
import { verifyWidgetToken, hashIp, WidgetTokenPayload } from "../jwt";
import { redis } from "../redis";
import { getSiteById, getDomainFromReq, isDomainAllowed } from "../services/siteService";

export interface WidgetRequest extends Request {
    widgetToken?: WidgetTokenPayload;
    site?: any;
}

export async function widgetAuth(req: WidgetRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization || "";
    const [type, token] = authHeader.split(" ");

    if (type !== "Bearer" || !token) {
        return res.status(401).json({ error: "Missing token" });
    }

    let payload: WidgetTokenPayload;
    try {
        payload = verifyWidgetToken(token);
    } catch {
        return res.status(401).json({ error: "Invalid token" });
    }

    // Optional: check Redis jti presence
    const exists = await redis.exists(`token:${payload.jti}`);
    if (!exists) {
        return res.status(401).json({ error: "Token expired or revoked" });
    }

    const site = await getSiteById(payload.siteId);
    if (!site || site.status !== "active") {
        return res.status(401).json({ error: "Unknown or inactive site" });
    }

    // Domain check
    const domain = getDomainFromReq(req);
    if (!isDomainAllowed(site, domain)) {
        return res.status(403).json({ error: "Domain not allowed" });
    }

    // Optional: IP binding
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip;
    if (payload.ipHash && payload.ipHash !== hashIp(ip)) {
        return res.status(401).json({ error: "IP mismatch" });
    }

    (req as WidgetRequest).widgetToken = payload;
    (req as WidgetRequest).site = site;
    (req as any).siteId = payload.siteId;

    next();
}
