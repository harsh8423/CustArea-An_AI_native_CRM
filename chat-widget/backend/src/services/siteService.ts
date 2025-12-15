import { redis } from "../redis";
import { query } from "../db";
import { CONFIG } from "../config";

export type Site = {
    id: string;
    name: string;
    public_key: string;
    api_key: string;
    allowed_domains: string[];
    status: "active" | "suspended";
};

const SITE_CACHE_PREFIX = "site:";

export async function getSiteById(siteId: string): Promise<Site | null> {
    const cacheKey = SITE_CACHE_PREFIX + siteId;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const { rows } = await query<Site>("SELECT * FROM sites WHERE id = $1", [siteId]);
    const site = rows[0] || null;

    if (site) {
        await redis.set(cacheKey, JSON.stringify(site), "EX", CONFIG.redisSiteTtlSeconds);
    }

    return site;
}

export function getDomainFromReq(req: any): string | null {
    const origin = (req.headers.origin || req.headers.referer || "") as string;
    try {
        return new URL(origin).hostname;
    } catch {
        return null;
    }
}

export function isDomainAllowed(site: Site, domain: string | null): boolean {
    if (!domain) return false;
    return site.allowed_domains.includes(domain);
}
