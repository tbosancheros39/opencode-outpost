import { CommandContext, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { setCurrentSession, type SessionInfo } from "../../session/manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { listSnapshots, getSnapshot } from "../../task-queue/store.js";
import { summaryAggregator } from "../../summary/aggregator.js";
import { clearAllInteractionState } from "../../interaction/cleanup.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";

const RESUME_CALLBACK_PREFIX = "resume:";
const RESUME_PAGE_CALLBACK_PREFIX = "resume:page:";
const SNAPSHOTS_PER_PAGE = 5;

/**
 * /resume command — restore from snapshot
 * Uses inline keyboard pattern from sessions command (07-command-sessions.ts)
 * Ensures resumeSession doesn't call sendMessage() (doesn't exist on SDK)
 */
export async function resumeCommand(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat?.id ?? 0;

  const currentProject = getCurrentProject(chatId);
  if (!currentProject) {
    await ctx.reply(t("bot.project_not_selected"));
    return;
  }

  try {
    // List all snapshots for this chat
    const allSnapshots = listSnapshots(); // All snapshots, we'll filter by chat

    const chatSnapshots = allSnapshots.filter((s) => s.chatId === chatId);

    if (chatSnapshots.length === 0) {
      await ctx.reply(t("cmd.resume.no_snapshots"));
      return;
    }

    await showResumeMenu(ctx, chatId, chatSnapshots, currentProject.worktree, 0);
  } catch (error) {
    logger.error("[Resume] Error listing snapshots:", error);
    await ctx.reply(t("cmd.resume.error"));
  }
}

async function showResumeMenu(
  ctx: CommandContext<Context>,
  _chatId: number,
  snapshots: Array<{ id: string; name: string; sessionId: string; sessionTitle: string; directory: string; createdAt: string }>,
  _worktree: string,
  page: number,
): Promise<void> {
  const start = page * SNAPSHOTS_PER_PAGE;
  const end = start + SNAPSHOTS_PER_PAGE;
  const pageSnapshots = snapshots.slice(start, end);
  const hasNext = end < snapshots.length;
  const hasPrev = page > 0;

  const keyboard = new InlineKeyboard();

  pageSnapshots.forEach((snapshot) => {
    const label = `${snapshot.sessionTitle} - ${snapshot.name}`;
    keyboard.text(label, `${RESUME_CALLBACK_PREFIX}${snapshot.id}`).row();
  });

  if (hasPrev) {
    keyboard.text(t("cmd.resume.prev_page"), `${RESUME_PAGE_CALLBACK_PREFIX}${page - 1}`);
  }
  if (hasNext) {
    keyboard.text(t("cmd.resume.next_page"), `${RESUME_PAGE_CALLBACK_PREFIX}${page + 1}`);
  }

  const header = page === 0
    ? t("cmd.resume.select")
    : t("cmd.resume.select_page", { page: String(page + 1) });

  await ctx.reply(header, {
    reply_markup: keyboard,
  });
}

/**
 * Resume a session from a snapshot
 * Does NOT call sendMessage() — uses SSE event aggregation instead
 */
async function resumeSession(
  ctx: CommandContext<Context>,
  chatId: number,
  snapshotId: string,
  worktree: string,
): Promise<void> {
  try {
    const snapshot = getSnapshot(snapshotId);

    if (!snapshot) {
      await ctx.reply(t("cmd.snapshot.not_found", { id: snapshotId }));
      return;
    }

    // Verify the session still exists via OpenCode client
    // Use session.get instead of sendMessage() which doesn't exist on SDK
    const { data: sessionData, error } = await opencodeClient.session.get({
      sessionID: snapshot.sessionId,
      directory: worktree,
    });

    if (error || !sessionData) {
      logger.warn(`[Resume] Session ${snapshot.sessionId} no longer exists`);
      await ctx.reply(t("cmd.resume.session_not_found", { id: snapshot.sessionId }));
      return;
    }

    // Restore the session
    const sessionInfo: SessionInfo = {
      id: sessionData.id,
      title: sessionData.title,
      directory: worktree,
    };

    setCurrentSession(chatId, sessionInfo);
    // Note: clear() wipes all sessions. For multi-session support,
    // consider using a session-specific clear if available.
    summaryAggregator.clear();
    clearAllInteractionState(chatId, "session_resumed");

    await ctx.reply(
      t("cmd.resume.success", {
        title: sessionData.title,
        name: snapshot.name,
      }),
    );

    logger.info(`[Resume] Restored session ${sessionData.id} from snapshot ${snapshotId}`);
  } catch (error) {
    logger.error("[Resume] Error resuming session:", error);
    await ctx.reply(t("cmd.resume.error"));
  }
}

/**
 * Handle resume callback queries
 * Pattern from 07-command-sessions.ts
 */
export async function handleResumeCallback(ctx: Context): Promise<boolean> {
  const callbackQuery = ctx.callbackQuery;
  if (!callbackQuery?.data) {
    return false;
  }

  if (callbackQuery.data.startsWith(RESUME_PAGE_CALLBACK_PREFIX)) {
    const pageStr = callbackQuery.data.slice(RESUME_PAGE_CALLBACK_PREFIX.length);
    const page = parseInt(pageStr, 10);
    if (isNaN(page) || page < 0) {
      await ctx.answerCallbackQuery({ text: t("callback.processing_error") });
      return true;
    }

    const chatId = ctx.chat?.id ?? 0;
    const currentProject = getCurrentProject(chatId);
    if (!currentProject) {
      await ctx.answerCallbackQuery({ text: t("bot.project_not_selected") });
      return true;
    }

    const allSnapshots = listSnapshots();
    const chatSnapshots = allSnapshots.filter((s) => s.chatId === chatId);

    await showResumeMenu(ctx as CommandContext<Context>, chatId, chatSnapshots, currentProject.worktree, page);
    await ctx.answerCallbackQuery();
    return true;
  }

  if (callbackQuery.data.startsWith(RESUME_CALLBACK_PREFIX)) {
    const snapshotId = callbackQuery.data.slice(RESUME_CALLBACK_PREFIX.length);
    const chatId = ctx.chat?.id ?? 0;
    const currentProject = getCurrentProject(chatId);

    if (!currentProject) {
      await ctx.answerCallbackQuery({ text: t("bot.project_not_selected") });
      return true;
    }

    await resumeSession(ctx as CommandContext<Context>, chatId, snapshotId, currentProject.worktree);
    await ctx.answerCallbackQuery();
    return true;
  }

  return false;
}
