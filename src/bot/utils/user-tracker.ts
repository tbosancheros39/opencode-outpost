import { logger } from "../../utils/logger.js";
import { config } from "../../config.js";

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
  return config.superUserIds.has(userId);
}

export function isDangerousPermission(permission: string): boolean {
  return DANGEROUS_PERMISSIONS.has(permission);
}
