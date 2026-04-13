import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { logger } from "../../utils/logger.js";

/**
 * Base directory for all global-mode (scratchpad) sessions.
 * Each chat gets its own subdirectory to avoid cross-user contamination.
 */
const GLOBAL_BASE_DIR = path.join(os.tmpdir(), "opencode-global-sessions");

/**
 * Returns (and creates if needed) a per-chat temporary working directory
 * used when the user sends a prompt without selecting a project first.
 */
export async function getOrCreateGlobalDirectory(chatId: number): Promise<string> {
  const chatDir = path.join(GLOBAL_BASE_DIR, `chat-${chatId}`);

  try {
    await fs.mkdir(chatDir, { recursive: true });
    logger.debug(`[GlobalMode] Ensured directory exists: ${chatDir}`);
  } catch (err) {
    logger.error(`[GlobalMode] Failed to create directory: ${chatDir}`, err);
    throw err;
  }

  return chatDir;
}

/**
 * Returns true if the given directory path lives under the global sessions base dir.
 * Used to detect whether a session is in global/scratchpad mode.
 */
export function isGlobalDirectory(directory: string): boolean {
  return directory.startsWith(GLOBAL_BASE_DIR);
}

/**
 * Removes per-chat global session directories older than `maxAgeHours`.
 * Intended to be called periodically (e.g. on bot startup) to prevent
 * stale tmp directories from accumulating.
 *
 * @param maxAgeHours - Default 168 hours (7 days)
 */
export async function cleanupOldGlobalDirectories(maxAgeHours: number = 168): Promise<void> {
  try {
    const entries = await fs.readdir(GLOBAL_BASE_DIR, { withFileTypes: true });
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dirPath = path.join(GLOBAL_BASE_DIR, entry.name);
      const stats = await fs.stat(dirPath);
      const age = now - stats.mtimeMs;

      if (age > maxAgeMs) {
        logger.info(
          `[GlobalMode] Cleaning up old directory: ${dirPath} (age: ${Math.round(age / 3600000)}h)`,
        );
        await fs.rm(dirPath, { recursive: true, force: true });
      }
    }
  } catch (err) {
    // Base dir may not exist yet on a fresh install — that's fine.
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.error("[GlobalMode] Error during cleanup:", err);
    }
  }
}

/** In-memory store for global mode prompt counts per chat. */
const globalPromptCounts = new Map<number, number>();

export function getGlobalPromptCount(chatId: number): number {
  return globalPromptCounts.get(chatId) || 0;
}

export function incrementGlobalPromptCount(chatId: number): void {
  const current = globalPromptCounts.get(chatId) || 0;
  globalPromptCounts.set(chatId, current + 1);
}

export function resetGlobalPromptCount(chatId: number): void {
  globalPromptCounts.delete(chatId);
}

/** Deletes the temporary working directory for a given chat. */
export async function deleteGlobalDirectory(chatId: number): Promise<void> {
  const chatDir = path.join(GLOBAL_BASE_DIR, `chat-${chatId}`);
  try {
    await fs.rm(chatDir, { recursive: true, force: true });
    logger.debug(`[GlobalMode] Deleted directory: ${chatDir}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.error(`[GlobalMode] Failed to delete directory: ${chatDir}`, err);
    }
  }
}
