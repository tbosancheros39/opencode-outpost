import type { Api, RawApi } from "grammy";
import { logger } from "../../utils/logger.js";

type SendMessageApi = Pick<Api<RawApi>, "sendMessage" | "deleteMessage">;

interface LoadingEntry {
  messageId: number;
  chatId: number;
}

const loadingMessages = new Map<string, LoadingEntry>();

function buildKey(sessionId: string): string {
  return sessionId;
}

export function storeLoadingMessage(
  sessionId: string,
  chatId: number,
  messageId: number,
): void {
  loadingMessages.set(buildKey(sessionId), { messageId, chatId });
  logger.debug(
    `[LoadingMessages] Stored loading message ${messageId} for session ${sessionId}`,
  );
}

export async function clearLoadingMessage(
  sessionId: string,
  api: SendMessageApi,
  reason: string,
): Promise<void> {
  const key = buildKey(sessionId);
  const entry = loadingMessages.get(key);
  if (!entry) {
    return;
  }

  loadingMessages.delete(key);

  try {
    await api.deleteMessage(entry.chatId, entry.messageId);
    logger.debug(
      `[LoadingMessages] Deleted loading message ${entry.messageId} for session ${sessionId}, reason=${reason}`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (msg.includes("message to delete not found") || msg.includes("message identifier is not specified")) {
      return;
    }
    logger.warn(
      `[LoadingMessages] Failed to delete loading message ${entry.messageId} for session ${sessionId}:`,
      error,
    );
  }
}

export function hasLoadingMessage(sessionId: string): boolean {
  return loadingMessages.has(buildKey(sessionId));
}
