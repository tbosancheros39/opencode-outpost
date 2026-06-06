import { Redis } from "ioredis";
import { config } from "../config.js";
import { opencodeClient } from "../opencode/client.js";
import { logger } from "../utils/logger.js";

export interface HealthCheck {
  ok: boolean;
  latencyMs?: number;
  error?: string;
  skipped?: boolean;
}

export async function checkRedisHealth(): Promise<HealthCheck> {
  const redisEnabled = process.env.REDIS_ENABLED;
  if (
    redisEnabled === "false" ||
    redisEnabled === "0" ||
    redisEnabled === "no"
  ) {
    logger.info("[Health] Redis disabled via REDIS_ENABLED, skipping");
    return { ok: true, skipped: true };
  }

  const redisUrl = config.redis.url;
  if (!redisUrl) {
    logger.info("[Health] No Redis URL configured, skipping");
    return { ok: true, skipped: true };
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
  });

  const start = Date.now();
  try {
    await client.connect();
    await client.ping();
    const latencyMs = Date.now() - start;
    logger.info(`[Health] Redis ping OK (${latencyMs}ms)`);
    return { ok: true, latencyMs };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn(`[Health] Redis ping failed: ${error}`);
    return { ok: false, error };
  } finally {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}

export async function checkOpencodeHealth(): Promise<HealthCheck> {
  try {
    const result = await opencodeClient.global.health();
    const ok = result.data?.healthy === true;
    logger.info(`[Health] OpenCode health check: ${ok ? "OK" : "unhealthy"}`);
    return { ok };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn(`[Health] OpenCode health check failed: ${error}`);
    return { ok: false, error };
  }
}
