import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.error("Redis error:", err));

export const connectRedis = async (): Promise<void> => {
  try {
    await redis.connect();
  } catch (error) {
    logger.error("Redis connection failed:", error);
  }
};
