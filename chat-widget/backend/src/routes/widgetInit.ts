import { Router, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import { getSiteById, getDomainFromReq, isDomainAllowed } from "../services/siteService";
import { findOrCreateEndUser } from "../services/userService";
import { signWidgetToken, hashIp } from "../jwt";
import { redis } from "../redis";
import { CONFIG } from "../config";

const router = Router();

router.post(
    "/widget/init",
    rateLimit("init"),
    async (req: Request, res: Response) => {
        const { siteId, anonId } = req.body || {};

        if (!siteId || !anonId) {
            return res.status(400).json({ error: "siteId and anonId required" });
        }

        const site = await getSiteById(siteId);
        if (!site || site.status !== "active") {
            return res.status(401).json({ error: "Unknown or inactive site" });
        }

        const domain = getDomainFromReq(req);
        if (!isDomainAllowed(site, domain)) {
            return res.status(403).json({ error: "Domain not allowed" });
        }

        const endUser = await findOrCreateEndUser(siteId, anonId);

        const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip;
        const token = signWidgetToken({
            siteId,
            externalId: anonId,
            ipHash: hashIp(ip),
        });

        const decoded: any = JSON.parse(
            Buffer.from(token.split(".")[1], "base64").toString("utf8")
        );
        const jti = decoded.jti as string;

        await redis.set(`token:${jti}`, "1", "EX", CONFIG.redisTokenTtlSeconds);

        return res.json({
            token,
            endUserId: endUser.id,
        });
    }
);

export default router;
