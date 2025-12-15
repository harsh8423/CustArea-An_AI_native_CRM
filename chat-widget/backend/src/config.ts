import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
    port: Number(process.env.PORT || 4000),
    databaseUrl: process.env.DATABASE_URL!,
    redisUrl: process.env.REDIS_URL!,
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpirySeconds: 15 * 60, // 15 minutes
    redisSiteTtlSeconds: 300, // 5 minutes
    redisTokenTtlSeconds: 15 * 60,
    rateLimitPerMin: 60,
    openAiApiKey: process.env.OPENAI_API_KEY,
};

if (!CONFIG.databaseUrl) console.warn("Missing DATABASE_URL");
if (!CONFIG.redisUrl) console.warn("Missing REDIS_URL");
if (!CONFIG.jwtSecret) console.warn("Missing JWT_SECRET");
if (!CONFIG.openAiApiKey) console.warn("Missing OPENAI_API_KEY");
