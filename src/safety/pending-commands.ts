import type { Context } from "grammy";

interface PendingCommand {
  command: string;
  sessionId: string;
  ctx: Context;
  timestamp: number;
}

const pendingCommands = new Map<string, PendingCommand>();
const COMMAND_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function storePendingCommand(messageId: number, command: string, sessionId: string, ctx: Context): void {
  pendingCommands.set(messageId.toString(), {
    command,
    sessionId,
    ctx,
    timestamp: Date.now(),
  });
  
  // Clean up old entries periodically
  cleanupExpiredCommands();
}

export function getPendingCommand(messageId: number): PendingCommand | undefined {
  return pendingCommands.get(messageId.toString());
}

export function removePendingCommand(messageId: number): boolean {
  return pendingCommands.delete(messageId.toString());
}

export function isPendingCommand(messageId: number): boolean {
  return pendingCommands.has(messageId.toString());
}

function cleanupExpiredCommands(): void {
  const now = Date.now();
  for (const [key, value] of pendingCommands.entries()) {
    if (now - value.timestamp > COMMAND_TIMEOUT_MS) {
      pendingCommands.delete(key);
    }
  }
}

// Clean up every 5 minutes
setInterval(cleanupExpiredCommands, COMMAND_TIMEOUT_MS);
