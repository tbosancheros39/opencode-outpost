import { CommandContext, Context } from "grammy";
import { stat } from "node:fs/promises";
import {
  getCurrentProject,
  getPinnedFiles,
  setPinnedFiles,
} from "../../settings/manager.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import { recentFilesTracker } from "../recent-files-tracker.js";
import { replyWithInlineMenu } from "../handlers/inline-menu.js";
import { buildPinKeyboard, buildPinMenuText, makeRelativePath } from "../utils/pin-helpers.js";

const MAX_PINNED_FILES = 10;
const MAX_RECENT_FILES_SHOWN = 10;

/**
 * /pin command — pin files to context
 * Without args: shows inline keyboard with recent + pinned files
 * With args: supports add, remove, clear, list subcommands
 */
export async function pinCommand(ctx: CommandContext<Context>): Promise<void> {
  const args = ctx.match?.toString().trim() ?? "";
  const chatId = ctx.chat?.id ?? 0;

  if (!args) {
    await showPinMenu(ctx, chatId);
    return;
  }

  const currentProject = getCurrentProject(chatId);
  if (!currentProject) {
    await ctx.reply(t("bot.project_not_selected"));
    return;
  }

  const subCommand = args.split(" ")[0].toLowerCase();
  const filePath = args.slice(subCommand.length).trim();

  switch (subCommand) {
    case "add":
      if (!filePath) {
        await ctx.reply(t("cmd.pin.usage_add"));
        return;
      }
      await addPinnedFile(ctx, chatId, filePath, currentProject.worktree);
      break;

    case "remove":
      if (!filePath) {
        await ctx.reply(t("cmd.pin.usage_remove"));
        return;
      }
      await removePinnedFile(ctx, chatId, filePath);
      break;

    case "clear":
      await clearPinnedFiles(ctx, chatId);
      break;

    case "list":
      await showPinnedFilesList(ctx, chatId);
      break;

    default:
      // If no subcommand provided, treat the whole args as a file path to add
      await addPinnedFile(ctx, chatId, args, currentProject.worktree);
      break;
  }
}

/**
 * Show the pin menu with recent files (tap to pin) and pinned files (tap to unpin).
 */
export async function showPinMenu(
  ctx: Context,
  chatId: number,
): Promise<void> {
  const currentProject = getCurrentProject(chatId);
  const worktree = currentProject?.worktree ?? "";

  const pinnedFiles = getPinnedFiles(chatId) ?? [];
  const recentFiles = recentFilesTracker
    .getRecentFiles(worktree, MAX_RECENT_FILES_SHOWN)
    .filter((f) => !pinnedFiles.includes(f));

  const keyboard = buildPinKeyboard(recentFiles, pinnedFiles, worktree);

  const text = buildPinMenuText(recentFiles, pinnedFiles, worktree);

  await replyWithInlineMenu(ctx, {
    menuKind: "pin",
    text,
    keyboard,
  });
}

/**
 * Show pinned files as a plain text list (for /pin list subcommand).
 */
async function showPinnedFilesList(
  ctx: CommandContext<Context>,
  chatId: number,
): Promise<void> {
  const pinnedFiles = getPinnedFiles(chatId);
  const currentProject = getCurrentProject(chatId);
  const worktree = currentProject?.worktree ?? "";

  if (!pinnedFiles || pinnedFiles.length === 0) {
    await ctx.reply(t("cmd.pin.empty"));
    return;
  }

  const lines = [
    t("cmd.pin.header"),
    "",
    ...pinnedFiles.map(
      (file, index) => `${index + 1}. ${makeRelativePath(file, worktree)}`,
    ),
    "",
    t("cmd.pin.hint"),
  ];

  await ctx.reply(lines.join("\n"));
}

async function addPinnedFile(
  ctx: CommandContext<Context>,
  chatId: number,
  filePath: string,
  worktree: string,
): Promise<void> {
  try {
    const pinnedFiles = getPinnedFiles(chatId) || [];

    if (pinnedFiles.length >= MAX_PINNED_FILES) {
      await ctx.reply(
        t("cmd.pin.limit_reached", { limit: String(MAX_PINNED_FILES) }),
      );
      return;
    }

    // Normalize the path
    const normalizedPath = filePath.startsWith("/")
      ? filePath
      : `${worktree}/${filePath}`;

    // Check if file exists via fs.stat
    let statResult;
    try {
      statResult = await stat(normalizedPath);
    } catch {
      await ctx.reply(t("cmd.pin.file_not_found", { path: filePath }));
      return;
    }

    if (statResult.isDirectory()) {
      await ctx.reply(t("cmd.pin.error_is_directory", { path: filePath }));
      return;
    }

    if (pinnedFiles.includes(normalizedPath)) {
      await ctx.reply(t("cmd.pin.already_pinned", { path: filePath }));
      return;
    }

    const newPinnedFiles = [...pinnedFiles, normalizedPath];
    setPinnedFiles(chatId, newPinnedFiles);

    await ctx.reply(
      t("cmd.pin.added", { path: makeRelativePath(normalizedPath, worktree) }),
    );
    logger.info(
      `[Pin] Added pinned file for chat ${chatId}: ${normalizedPath}`,
    );
  } catch (error) {
    logger.error("[Pin] Error adding pinned file:", error);
    await ctx.reply(t("cmd.pin.error_add"));
  }
}

async function removePinnedFile(
  ctx: CommandContext<Context>,
  chatId: number,
  filePath: string,
): Promise<void> {
  try {
    const pinnedFiles = getPinnedFiles(chatId) || [];
    const currentProject = getCurrentProject(chatId);
    const worktree = currentProject?.worktree ?? "";

    // Try exact match first, then partial match
    let index = pinnedFiles.indexOf(filePath);
    if (index === -1) {
      // Try matching as relative path
      index = pinnedFiles.findIndex(
        (f) =>
          f.endsWith(filePath) ||
          f.includes(filePath) ||
          makeRelativePath(f, worktree) === filePath,
      );
    }

    if (index === -1) {
      await ctx.reply(t("cmd.pin.not_found", { path: filePath }));
      return;
    }

    const removed = pinnedFiles[index];
    const newPinnedFiles = pinnedFiles.filter((_, i) => i !== index);
    setPinnedFiles(chatId, newPinnedFiles);

    await ctx.reply(
      t("cmd.pin.removed", {
        path: makeRelativePath(removed, worktree),
      }),
    );
    logger.info(`[Pin] Removed pinned file for chat ${chatId}: ${removed}`);
  } catch (error) {
    logger.error("[Pin] Error removing pinned file:", error);
    await ctx.reply(t("cmd.pin.error_remove"));
  }
}

async function clearPinnedFiles(
  ctx: CommandContext<Context>,
  chatId: number,
): Promise<void> {
  try {
    setPinnedFiles(chatId, []);
    await ctx.reply(t("cmd.pin.cleared"));
    logger.info(`[Pin] Cleared all pinned files for chat ${chatId}`);
  } catch (error) {
    logger.error("[Pin] Error clearing pinned files:", error);
    await ctx.reply(t("cmd.pin.error_clear"));
  }
}