import { Context } from "grammy";
import { stat } from "node:fs/promises";
import {
  getCurrentProject,
  getPinnedFiles,
  setPinnedFiles,
} from "../../settings/manager.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import { recentFilesTracker } from "../recent-files-tracker.js";
import {
  clearActiveInlineMenu,
  ensureActiveInlineMenu,
  appendInlineMenuCancelButton,
} from "./inline-menu.js";
import { buildPinKeyboard, buildPinMenuText, makeRelativePath } from "../utils/pin-helpers.js";

const MAX_PINNED_FILES = 10;
const MAX_RECENT_FILES_SHOWN = 10;

/**
 * Handle pin/unpin/clear/refresh callback queries.
 * Callback data format:
 *   pin:r:<index>  — pin a recent file at index
 *   pin:u:<index>  — unpin a pinned file at index
 *   pin:clear      — clear all pinned files
 *   pin:refresh    — refresh the pin menu
 */
export async function handlePinCallback(ctx: Context): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data || !data.startsWith("pin:")) {
    return false;
  }

  const chatId = ctx.chat?.id ?? 0;

  // Verify the menu is still active
  const isActive = await ensureActiveInlineMenu(ctx, "pin");
  if (!isActive) {
    return true;
  }

  const action = data.slice(4); // Remove "pin:" prefix

  switch (action) {
    case "clear":
      await handlePinClear(ctx, chatId);
      return true;

    case "refresh":
      await handlePinRefresh(ctx, chatId);
      return true;

    default:
      // Check for r:<index> or u:<index>
      if (action.startsWith("r:")) {
        const indexStr = action.slice(2);
        const index = parseInt(indexStr, 10);
        if (isNaN(index)) {
          await ctx.answerCallbackQuery({ text: t("callback.unknown_command") });
          return true;
        }
        await handlePinRecent(ctx, chatId, index);
        return true;
      }

      if (action.startsWith("u:")) {
        const indexStr = action.slice(2);
        const index = parseInt(indexStr, 10);
        if (isNaN(index)) {
          await ctx.answerCallbackQuery({ text: t("callback.unknown_command") });
          return true;
        }
        await handlePinUnpin(ctx, chatId, index);
        return true;
      }

      // Unknown pin action
      await ctx.answerCallbackQuery({ text: t("callback.unknown_command") });
      return true;
  }
}

/**
 * Pin a recent file by index.
 */
async function handlePinRecent(
  ctx: Context,
  chatId: number,
  index: number,
): Promise<void> {
  const currentProject = getCurrentProject(chatId);
  const worktree = currentProject?.worktree ?? "";
  const pinnedFiles = getPinnedFiles(chatId) ?? [];
  const recentFiles = recentFilesTracker
    .getRecentFiles(worktree, MAX_RECENT_FILES_SHOWN)
    .filter((f) => !pinnedFiles.includes(f));

  if (index < 0 || index >= recentFiles.length) {
    await ctx.answerCallbackQuery({ text: t("cmd.pin.callback_invalid_index") });
    return;
  }

  const filePath = recentFiles[index];

  if (pinnedFiles.length >= MAX_PINNED_FILES) {
    await ctx.answerCallbackQuery({
      text: t("cmd.pin.limit_reached", { limit: String(MAX_PINNED_FILES) }),
      show_alert: true,
    });
    return;
  }

  // Check file exists
  try {
    const statResult = await stat(filePath);
    if (statResult.isDirectory()) {
      await ctx.answerCallbackQuery({
        text: t("cmd.pin.error_is_directory", { path: makeRelativePath(filePath, worktree) }),
        show_alert: true,
      });
      return;
    }
  } catch {
    await ctx.answerCallbackQuery({
      text: t("cmd.pin.file_not_found", { path: makeRelativePath(filePath, worktree) }),
      show_alert: true,
    });
    return;
  }

  if (pinnedFiles.includes(filePath)) {
    await ctx.answerCallbackQuery({
      text: t("cmd.pin.already_pinned", { path: makeRelativePath(filePath, worktree) }),
    });
    return;
  }

  // Pin the file
  const newPinnedFiles = [...pinnedFiles, filePath];
  setPinnedFiles(chatId, newPinnedFiles);

  const relativePath = makeRelativePath(filePath, worktree);
  await ctx.answerCallbackQuery({
    text: t("cmd.pin.added", { path: relativePath }),
  });

  logger.info(`[Pin] Pinned file via callback for chat ${chatId}: ${filePath}`);

  // Update the menu
  await updatePinMenu(ctx, chatId);
}

/**
 * Unpin a file by index.
 */
async function handlePinUnpin(
  ctx: Context,
  chatId: number,
  index: number,
): Promise<void> {
  const currentProject = getCurrentProject(chatId);
  const worktree = currentProject?.worktree ?? "";
  const pinnedFiles = getPinnedFiles(chatId) ?? [];

  if (index < 0 || index >= pinnedFiles.length) {
    await ctx.answerCallbackQuery({ text: t("cmd.pin.callback_invalid_index") });
    return;
  }

  const removed = pinnedFiles[index];
  const newPinnedFiles = pinnedFiles.filter((_, i) => i !== index);
  setPinnedFiles(chatId, newPinnedFiles);

  const relativePath = makeRelativePath(removed, worktree);
  await ctx.answerCallbackQuery({
    text: t("cmd.pin.removed", { path: relativePath }),
  });

  logger.info(`[Pin] Unpinned file via callback for chat ${chatId}: ${removed}`);

  // Update the menu
  await updatePinMenu(ctx, chatId);
}

/**
 * Clear all pinned files.
 */
async function handlePinClear(ctx: Context, chatId: number): Promise<void> {
  setPinnedFiles(chatId, []);
  clearActiveInlineMenu(chatId, "pin_cleared");

  await ctx.answerCallbackQuery({ text: t("cmd.pin.cleared") });
  await ctx.deleteMessage().catch(() => {});

  logger.info(`[Pin] Cleared all pinned files via callback for chat ${chatId}`);
}

/**
 * Refresh the pin menu.
 */
async function handlePinRefresh(ctx: Context, chatId: number): Promise<void> {
  await ctx.answerCallbackQuery({ text: "🔄" });
  await updatePinMenu(ctx, chatId);
}

/**
 * Update the pin menu by editing the existing message.
 */
async function updatePinMenu(ctx: Context, chatId: number): Promise<void> {
  const currentProject = getCurrentProject(chatId);
  const worktree = currentProject?.worktree ?? "";
  const pinnedFiles = getPinnedFiles(chatId) ?? [];
  const recentFiles = recentFilesTracker
    .getRecentFiles(worktree, MAX_RECENT_FILES_SHOWN)
    .filter((f) => !pinnedFiles.includes(f));

  const text = buildPinMenuText(recentFiles, pinnedFiles, worktree);
  const keyboard = buildPinKeyboard(recentFiles, pinnedFiles, worktree);

  // Append cancel button via the inline menu system
  appendInlineMenuCancelButton(keyboard, "pin");

  const message = ctx.callbackQuery?.message;
  if (!message || !("message_id" in message)) {
    return;
  }

  try {
    await ctx.api.editMessageText(
      chatId,
      message.message_id,
      text,
      { reply_markup: keyboard },
    );
  } catch (err) {
    // "message is not modified" is fine — means the state didn't change
    if (err instanceof Error && err.message?.includes("message is not modified")) {
      return;
    }
    logger.error("[PinCallback] Error updating pin menu:", err);
  }
}
