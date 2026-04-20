import type { Context, NextFunction } from "grammy";
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory storage for rate limiting per chat
const rateLimitMap = new Map<number, RateLimitEntry>();

/**
 * Rate limiting middleware - limits the number of messages per chat within a time window.
 * Uses in-memory Map (does NOT survive restarts).
 */
export async function rateLimitMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await next();
    return;
  }

  const now = Date.now();
  const windowMs = config.bot.rateLimitWindowMs;
  const maxMessages = config.bot.rateLimitMessages;

  const entry = rateLimitMap.get(chatId);

  if (!entry) {
    // First message from this chat
    rateLimitMap.set(chatId, {
      count: 1,
      resetTime: now + windowMs,
    });
    await next();
    return;
  }

  // Check if the window has expired
  if (now > entry.resetTime) {
    // Reset the window
    rateLimitMap.set(chatId, {
      count: 1,
      resetTime: now + windowMs,
    });
    await next();
    return;
  }

  // Check if the limit is exceeded
  if (entry.count >= maxMessages) {
    logger.warn(`[RateLimit] Chat ${chatId} exceeded rate limit (${maxMessages} messages in ${windowMs}ms)`);
    await ctx.reply(t("rate_limit.exceeded"));
    return;
  }

  // Increment the count and allow the message
  entry.count++;
  await next();
}

/**
 * Get the current rate limit count for a chat (for debugging/monitoring).
 */
export function getRateLimitCount(chatId: number): number {
  return rateLimitMap.get(chatId)?.count ?? 0;
}

/**
 * Reset rate limit for a specific chat.
 */
export function resetRateLimit(chatId: number): void {
  rateLimitMap.delete(chatId);
}

/**
 * Clean up expired rate limit entries.
 */
export function cleanupExpiredRateLimits(): void {
  const now = Date.now();
  for (const [chatId, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(chatId);
    }
  }
}
