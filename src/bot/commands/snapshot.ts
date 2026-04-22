import { CommandContext, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { getCurrentProject } from "../../settings/manager.js";
import { getCurrentSession } from "../../session/manager.js";
import {
  createSnapshot,
  listSnapshots,
  deleteSnapshot,
  getSnapshot,
} from "../../task-queue/store.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";

const SNAPSHOT_CALLBACK_PREFIX = "snapshot:";
const SNAPSHOT_PAGE_CALLBACK_PREFIX = "snapshot:page:";
const SNAPSHOTS_PER_PAGE = 5;

/**
 * /snapshot command — save session context to SQLite
 * Uses the existing task-queue SQLite store (session_snapshots table)
 */
export async function snapshotCommand(ctx: CommandContext<Context>): Promise<void> {
  const args = ctx.match?.toString().trim() ?? "";
  const chatId = ctx.chat?.id ?? 0;

  const currentProject = getCurrentProject(chatId);
  if (!currentProject) {
    await ctx.reply(t("bot.project_not_selected"));
    return;
  }

  const currentSession = getCurrentSession(chatId);
  if (!currentSession) {
    await ctx.reply(t("cmd.snapshot.no_session"));
    return;
  }

  const subCommand = args.split(" ")[0].toLowerCase();

  switch (subCommand) {
    case "save":
      await saveSnapshot(ctx, chatId, currentSession.id, currentSession.title, currentProject.worktree);
      break;

    case "list":
      await listSnapshotsCommand(ctx, chatId, currentSession.id);
      break;

    case "load": {
      const snapshotId = args.slice(subCommand.length).trim();
      if (!snapshotId) {
        await ctx.reply(t("cmd.snapshot.usage_load"));
        return;
      }
      await loadSnapshot(ctx, chatId, snapshotId, currentProject.worktree);
      break;
    }

    case "delete": {
      const snapshotId = args.slice(subCommand.length).trim();
      if (!snapshotId) {
        await ctx.reply(t("cmd.snapshot.usage_delete"));
        return;
      }
      await deleteSnapshotCommand(ctx, chatId, snapshotId);
      break;
    }

    case "":
      // No subcommand — save current session with auto-generated name
      await saveSnapshot(ctx, chatId, currentSession.id, currentSession.title, currentProject.worktree);
      break;

    default:
      // Treat as a custom snapshot name
      await saveSnapshot(ctx, chatId, currentSession.id, currentSession.title, currentProject.worktree, args);
      break;
  }
}

async function saveSnapshot(
  ctx: CommandContext<Context>,
  chatId: number,
  sessionId: string,
  sessionTitle: string,
  worktree: string,
  customName?: string,
): Promise<void> {
  try {
    const MAX_NAME_LEN = 100;
    if (customName && customName.length > MAX_NAME_LEN) {
      await ctx.reply(t("cmd.snapshot.error_name_too_long"));
      return;
    }

    const snapshot = createSnapshot({
      chatId,
      sessionId,
      sessionTitle,
      directory: worktree,
      name: customName || `Snapshot ${new Date().toLocaleString()}`,
    });

    await ctx.reply(
      t("cmd.snapshot.saved", {
        name: snapshot.name,
        id: snapshot.id,
      }),
    );
    logger.info(`[Snapshot] Saved snapshot ${snapshot.id} for session ${sessionId}`);
  } catch (error) {
    logger.error("[Snapshot] Error saving snapshot:", error);
    await ctx.reply(t("cmd.snapshot.error_save"));
  }
}

async function listSnapshotsCommand(
  ctx: CommandContext<Context>,
  _chatId: number,
  sessionId: string,
  page: number = 0,
): Promise<void> {
  try {
    const allSnapshots = listSnapshots(sessionId);

    if (allSnapshots.length === 0) {
      await ctx.reply(t("cmd.snapshot.empty"));
      return;
    }

    // Paginate
    const start = page * SNAPSHOTS_PER_PAGE;
    const end = start + SNAPSHOTS_PER_PAGE;
    const snapshots = allSnapshots.slice(start, end);
    const hasNext = end < allSnapshots.length;
    const hasPrev = page > 0;

    const keyboard = new InlineKeyboard();

    snapshots.forEach((snapshot) => {
      const label = `${snapshot.name} (${new Date(snapshot.createdAt).toLocaleDateString()})`;
      keyboard.text(label, `${SNAPSHOT_CALLBACK_PREFIX}${snapshot.id}`).row();
    });

    if (hasPrev) {
      keyboard.text(t("cmd.snapshot.prev_page"), `${SNAPSHOT_PAGE_CALLBACK_PREFIX}${page - 1}`);
    }
    if (hasNext) {
      keyboard.text(t("cmd.snapshot.next_page"), `${SNAPSHOT_PAGE_CALLBACK_PREFIX}${page + 1}`);
    }

    const header = page === 0 ? t("cmd.snapshot.list_header") : t("cmd.snapshot.list_page", { page: String(page + 1) });

    await ctx.reply(header, {
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error("[Snapshot] Error listing snapshots:", error);
    await ctx.reply(t("cmd.snapshot.error_list"));
  }
}

async function loadSnapshot(
  ctx: CommandContext<Context>,
  _chatId: number,
  snapshotId: string,
  _worktree: string,
): Promise<void> {
  try {
    const snapshot = getSnapshot(snapshotId);

    if (!snapshot) {
      await ctx.reply(t("cmd.snapshot.not_found", { id: snapshotId }));
      return;
    }

    await ctx.reply(
      t("cmd.snapshot.info", {
        name: snapshot.name,
        id: snapshot.id,
        session: snapshot.sessionTitle,
        date: new Date(snapshot.createdAt).toLocaleString(),
      }),
    );
  } catch (error) {
    logger.error("[Snapshot] Error loading snapshot:", error);
    await ctx.reply(t("cmd.snapshot.error_load"));
  }
}

async function deleteSnapshotCommand(
  ctx: CommandContext<Context>,
  _chatId: number,
  snapshotId: string,
): Promise<void> {
  try {
    const deleted = deleteSnapshot(snapshotId);

    if (!deleted) {
      await ctx.reply(t("cmd.snapshot.not_found", { id: snapshotId }));
      return;
    }

    await ctx.reply(t("cmd.snapshot.deleted", { id: snapshotId }));
    logger.info(`[Snapshot] Deleted snapshot ${snapshotId}`);
  } catch (error) {
    logger.error("[Snapshot] Error deleting snapshot:", error);
    await ctx.reply(t("cmd.snapshot.error_delete"));
  }
}

/**
 * Handle snapshot callback queries
 */
export async function handleSnapshotCallback(ctx: Context): Promise<boolean> {
  const callbackQuery = ctx.callbackQuery;
  if (!callbackQuery?.data) {
    return false;
  }

  if (callbackQuery.data.startsWith(SNAPSHOT_PAGE_CALLBACK_PREFIX)) {
    const pageStr = callbackQuery.data.slice(SNAPSHOT_PAGE_CALLBACK_PREFIX.length);
    const page = parseInt(pageStr, 10);
    if (isNaN(page) || page < 0) {
      await ctx.answerCallbackQuery({ text: t("callback.processing_error") });
      return true;
    }

    const chatId = ctx.chat?.id ?? 0;
    const currentSession = getCurrentSession(chatId);
    if (!currentSession) {
      await ctx.answerCallbackQuery({ text: t("cmd.snapshot.no_session") });
      return true;
    }

    await listSnapshotsCommand(ctx as CommandContext<Context>, chatId, currentSession.id, page);
    await ctx.answerCallbackQuery();
    return true;
  }

  if (callbackQuery.data.startsWith(SNAPSHOT_CALLBACK_PREFIX)) {
    const snapshotId = callbackQuery.data.slice(SNAPSHOT_CALLBACK_PREFIX.length);
    const chatId = ctx.chat?.id ?? 0;
    const currentProject = getCurrentProject(chatId);

    if (!currentProject) {
      await ctx.answerCallbackQuery({ text: t("bot.project_not_selected") });
      return true;
    }

    await loadSnapshot(ctx as CommandContext<Context>, chatId, snapshotId, currentProject.worktree);
    await ctx.answerCallbackQuery();
    return true;
  }

  return false;
}
