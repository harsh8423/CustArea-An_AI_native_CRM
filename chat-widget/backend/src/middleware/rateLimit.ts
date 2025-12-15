import { Request, Response, NextFunction } from "express";
import { redis } from "../redis";
import { CONFIG } from "../config";

export function rateLimit(prefix: string, limit: number = CONFIG.rateLimitPerMin) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip;
        const siteId = (req.body.siteId || (req as any).siteId || "unknown") as string;

        const key = `rl:${prefix}:site:${siteId}:ip:${ip}`;
        const current = await redis.incr(key);
        if (current === 1) {
            await redis.expire(key, 60);
        }

        if (current > limit) {
            return res.status(429).json({ error: "Too many requests" });
        }

        next();
    };
}
