import { logger } from "../../utils/logger.js";
import { SUPER_USER_IDS } from "../../constants.js";

/**
 * Tracks the current userId per chatId.
 * Needed because permission events come from SSE (no user context),
 * so we need to know which user triggered the session.
 */

const DANGEROUS_PERMISSIONS = new Set(["bash", "edit", "write", "task", "external_directory"]);

const chatUserMap = new Map<number, number>();

export function trackChatUser(chatId: number, userId: number): void {
  chatUserMap.set(chatId, userId);
  logger.debug(`[UserTracker] Tracked chatId=${chatId} -> userId=${userId}`);
}

export function getUserIdForChat(chatId: number): number | null {
  return chatUserMap.get(chatId) ?? null;
}

export function isSuperUser(userId: number): boolean {
  return SUPER_USER_IDS.has(userId);
}

export function isDangerousPermission(permission: string): boolean {
  return DANGEROUS_PERMISSIONS.has(permission);
}
