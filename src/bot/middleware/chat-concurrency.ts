import type { Context, NextFunction } from "grammy";
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";

interface ActiveChatEntry {
  userId: number;
  timestamp: number;
}

// In-memory storage for active chats (chatId -> { userId, timestamp })
const activeChats = new Map<number, ActiveChatEntry>();

// Default timeout for inactive chat cleanup (5 minutes)
const DEFAULT_CHAT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Register a chat as active.
 */
export function registerActiveChat(chatId: number, userId: number): void {
  activeChats.set(chatId, {
    userId,
    timestamp: Date.now(),
  });
  logger.debug(`[ChatConcurrency] Registered active chat: ${chatId} (user: ${userId})`);
}

/**
 * Unregister a chat (mark as inactive).
 */
export function unregisterActiveChat(chatId: number): void {
  activeChats.delete(chatId);
  logger.debug(`[ChatConcurrency] Unregistered active chat: ${chatId}`);
}

/**
 * Get the count of currently active chats.
 */
export function getActiveChatCount(): number {
  return activeChats.size;
}

/**
 * Get the set of active chat IDs.
 */
export function getActiveChatIds(): number[] {
  return Array.from(activeChats.keys());
}

/**
 * Check if a specific chat is currently active.
 */
export function isChatActive(chatId: number): boolean {
  return activeChats.has(chatId);
}

/**
 * Update the last activity timestamp for a chat.
 */
export function updateChatActivity(chatId: number): void {
  const entry = activeChats.get(chatId);
  if (entry) {
    entry.timestamp = Date.now();
  }
}

/**
 * Clean up inactive chats that haven't had activity for longer than the timeout.
 */
export function cleanupInactiveChats(timeoutMs: number = DEFAULT_CHAT_TIMEOUT_MS): number {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [chatId, entry] of activeChats.entries()) {
    if (now - entry.timestamp > timeoutMs) {
      activeChats.delete(chatId);
      cleanedCount++;
      logger.debug(`[ChatConcurrency] Cleaned up inactive chat: ${chatId}`);
    }
  }

  if (cleanedCount > 0) {
    logger.info(`[ChatConcurrency] Cleaned up ${cleanedCount} inactive chats`);
  }

  return cleanedCount;
}

/**
 * Chat concurrency middleware - limits the number of concurrent active chats per user.
 * Uses in-memory Map (does NOT survive restarts).
 */
export async function chatConcurrencyMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;

  if (!chatId || !userId) {
    await next();
    return;
  }

  const maxConcurrent = config.bot.maxConcurrentChats;

  // If this chat is already active, just update activity and allow
  if (isChatActive(chatId)) {
    updateChatActivity(chatId);
    await next();
    return;
  }

  // Count active chats for this user (excluding current chat)
  const userActiveChats = Array.from(activeChats.entries()).filter(
    ([id, entry]) => entry.userId === userId && id !== chatId
  );

  // Check if the user has reached the limit
  if (userActiveChats.length >= maxConcurrent) {
    logger.warn(
      `[ChatConcurrency] User ${userId} exceeded concurrent chat limit (${maxConcurrent})`
    );
    await ctx.reply(t("chat_limit.exceeded"));
    return;
  }

  // Register this chat as active
  registerActiveChat(chatId, userId);
  await next();
}

/**
 * Schedule periodic cleanup of inactive chats.
 * Returns the interval ID (can be used with clearInterval to stop).
 */
export function scheduleInactiveChatCleanup(
  intervalMs: number = DEFAULT_CHAT_TIMEOUT_MS
): ReturnType<typeof setInterval> {
  return setInterval(() => {
    cleanupInactiveChats();
  }, intervalMs);
}
