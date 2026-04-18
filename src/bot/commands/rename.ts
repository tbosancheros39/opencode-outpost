import { CommandContext, Context, InlineKeyboard } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentSession, setCurrentSession } from "../../session/manager.js";
import { renameManager } from "../../rename/manager.js";
import { interactionManager } from "../../interaction/manager.js";
import { pinnedMessageManager } from "../../pinned/manager.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";

function getCallbackMessageId(ctx: Context): number | null {
  const message = ctx.callbackQuery?.message;
  if (!message || !("message_id" in message)) {
    return null;
  }

  const messageId = (message as { message_id?: number }).message_id;
  return typeof messageId === "number" ? messageId : null;
}

function clearRenameInteraction(chatId: number, reason: string): void {
  const state = interactionManager.getSnapshot(chatId);
  if (state?.kind === "rename") {
    interactionManager.clear(chatId, reason);
  }
}

export async function renameCommand(ctx: CommandContext<Context>): Promise<void> {
  try {
    const chatId = ctx.chat?.id ?? 0;
    const currentSession = getCurrentSession(chatId);

    if (!currentSession) {
      await ctx.reply(t("rename.no_session"));
      return;
    }

    const keyboard = new InlineKeyboard().text(t("rename.button.cancel"), "rename:cancel");

    const message = await ctx.reply(t("rename.prompt", { title: currentSession.title }), {
      reply_markup: keyboard,
    });

    renameManager.startWaiting(chatId, currentSession.id, currentSession.directory, currentSession.title);
    renameManager.setMessageId(chatId, message.message_id);
    interactionManager.start(chatId, {
      kind: "rename",
      expectedInput: "text",
      metadata: {
        sessionId: currentSession.id,
        messageId: message.message_id,
      },
    });

    logger.info(`[RenameCommand] Waiting for new title for session: ${currentSession.id}`);
  } catch (error) {
    logger.error("[RenameCommand] Error starting rename flow:", error);
    await ctx.reply(t("rename.error"));
  }
}

export async function handleRenameCancel(ctx: Context): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data || data !== "rename:cancel") {
    return false;
  }

  logger.debug("[RenameHandler] Cancel callback received");

  const chatId = ctx.chat?.id ?? 0;

  if (!renameManager.isWaitingForName(chatId)) {
    clearRenameInteraction(chatId, "rename_cancel_inactive");
    await ctx.answerCallbackQuery({ text: t("rename.inactive_callback"), show_alert: true });
    return true;
  }

  const interactionState = interactionManager.getSnapshot(chatId);
  if (interactionState?.kind !== "rename") {
    renameManager.clear(chatId);
    await ctx.answerCallbackQuery({ text: t("rename.inactive_callback"), show_alert: true });
    return true;
  }

  const callbackMessageId = getCallbackMessageId(ctx);
  if (!renameManager.isActiveMessage(chatId, callbackMessageId)) {
    await ctx.answerCallbackQuery({ text: t("rename.inactive_callback"), show_alert: true });
    return true;
  }

  renameManager.clear(chatId);
  clearRenameInteraction(chatId, "rename_cancelled");

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(t("rename.cancelled")).catch(() => {});

  return true;
}

export async function handleRenameTextAnswer(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat?.id ?? 0;

  if (!renameManager.isWaitingForName(chatId)) {
    return false;
  }

  const text = ctx.message?.text;
  if (!text) {
    return false;
  }

  if (text.startsWith("/")) {
    return false;
  }

  const interactionState = interactionManager.getSnapshot(chatId);
  if (interactionState?.kind !== "rename") {
    renameManager.clear(chatId);
    await ctx.reply(t("rename.inactive"));
    return true;
  }

  const sessionInfo = renameManager.getSessionInfo(chatId);
  if (!sessionInfo) {
    renameManager.clear(chatId);
    clearRenameInteraction(chatId, "rename_missing_session_info");
    return false;
  }

  const newTitle = text.trim();
  if (!newTitle) {
    await ctx.reply(t("rename.empty_title"));
    return true;
  }

  logger.info(`[RenameHandler] Renaming session ${sessionInfo.sessionId} to: ${newTitle}`);

  try {
    const { data: updatedSession, error } = await opencodeClient.session.update({
      sessionID: sessionInfo.sessionId,
      directory: sessionInfo.directory,
      title: newTitle,
    });

    if (error || !updatedSession) {
      throw error || new Error("Failed to update session");
    }

    setCurrentSession(chatId, {
      id: sessionInfo.sessionId,
      title: newTitle,
      directory: sessionInfo.directory,
    });

    if (ctx.chat && pinnedMessageManager.isInitialized(ctx.chat.id)) {
      await pinnedMessageManager.onSessionChange(ctx.chat.id, sessionInfo.sessionId, newTitle);
    }

    const messageId = renameManager.getMessageId(chatId);
    if (messageId && ctx.chat) {
      await ctx.api.deleteMessage(ctx.chat.id, messageId).catch(() => {});
    }

    await ctx.reply(t("rename.success", { title: newTitle }));

    logger.info(`[RenameHandler] Session renamed successfully: ${newTitle}`);
  } catch (error) {
    logger.error("[RenameHandler] Error renaming session:", error);
    await ctx.reply(t("rename.error"));
  }

  renameManager.clear(chatId);
  clearRenameInteraction(chatId, "rename_completed");
  return true;
}
