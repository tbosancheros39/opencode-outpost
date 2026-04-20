import { logger } from "../../utils/logger.js";

const draftIds = new Map<number, number>(); // chatId → draftId

export function storeDraftId(chatId: number, draftId: number): void {
  draftIds.set(chatId, draftId);
  logger.debug(`[DraftMessages] Stored draft ID ${draftId} for chat ${chatId}`);
}

export function getDraftId(chatId: number): number | undefined {
  return draftIds.get(chatId);
}

export function clearDraftId(chatId: number): void {
  const existed = draftIds.delete(chatId);
  if (existed) {
    logger.debug(`[DraftMessages] Cleared draft ID for chat ${chatId}`);
  }
}

export function hasDraftId(chatId: number): boolean {
  return draftIds.has(chatId);
}
