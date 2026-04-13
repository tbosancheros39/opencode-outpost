import { CommandContext, Context, InlineKeyboard } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentSession } from "../../session/manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { interactionManager } from "../../interaction/manager.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import { getDateLocale } from "../../i18n/index.js";

const MESSAGES_CALLBACK_PREFIX = "messages:";
const MESSAGES_PAGE_PREFIX = `${MESSAGES_CALLBACK_PREFIX}page:`;
const MESSAGES_FORK_PREFIX = `${MESSAGES_CALLBACK_PREFIX}fork:`;
const MESSAGES_REVERT_PREFIX = `${MESSAGES_CALLBACK_PREFIX}revert:`;
const MESSAGES_CANCEL = `${MESSAGES_CALLBACK_PREFIX}cancel`;

const MESSAGES_PER_PAGE = 10;

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  messageID: string;
}

interface MessagesPage {
  messages: MessageItem[];
  hasNext: boolean;
  hasPrev: boolean;
  page: number;
  totalMessages: number;
}

interface MessagesMetadata {
  flow: "messages";
  stage: "list";
  messageId: number;
  sessionId: string;
  directory: string;
  messages: MessageItem[];
  page: number;
  totalMessages: number;
}

function parseMessagesPageCallback(data: string): number | null {
  if (!data.startsWith(MESSAGES_PAGE_PREFIX)) {
    return null;
  }
  const rawPage = data.slice(MESSAGES_PAGE_PREFIX.length);
  const page = Number(rawPage);
  if (!Number.isInteger(page) || page < 0) {
    return null;
  }
  return page;
}

function parseForkCallback(data: string): string | null {
  if (!data.startsWith(MESSAGES_FORK_PREFIX)) {
    return null;
  }
  return data.slice(MESSAGES_FORK_PREFIX.length);
}

function parseRevertCallback(data: string): string | null {
  if (!data.startsWith(MESSAGES_REVERT_PREFIX)) {
    return null;
  }
  return data.slice(MESSAGES_REVERT_PREFIX.length);
}

function extractTextFromParts(parts: Array<{ type: string; text?: string }>): string | null {
  const textParts = parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string);
  if (textParts.length === 0) {
    return null;
  }
  const text = textParts.join("").trim();
  return text.length > 0 ? text : null;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  const clipped = text.slice(0, Math.max(0, maxLength - 3)).trimEnd();
  return `${clipped}...`;
}

async function loadMessagesPage(
  sessionId: string,
  directory: string,
  page: number,
): Promise<MessagesPage> {
  const { data: allMessages, error } = await opencodeClient.session.messages({
    sessionID: sessionId,
    directory,
    limit: 1000,
  });

  if (error || !allMessages) {
    throw error || new Error("Failed to fetch messages");
  }

  const relevantMessages = allMessages
    .map((msg: Record<string, unknown>) => {
      const info = msg.info as Record<string, unknown>;
      const parts = msg.parts as Array<{ type: string; text?: string }>;
      const role = info.role as "user" | "assistant" | undefined;
      if (role !== "user" && role !== "assistant") {
        return null;
      }
      if ((info as { summary?: boolean }).summary) {
        return null;
      }
      const text = extractTextFromParts(parts);
      if (!text) {
        return null;
      }
      return {
        id: info.id as string,
        messageID: info.id as string,
        role,
        text: truncateText(text, 80),
        timestamp: (info.time as { created?: number })?.created ?? 0,
      };
    })
    .filter((item): item is MessageItem => item !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  const totalMessages = relevantMessages.length;
  const start = page * MESSAGES_PER_PAGE;
  const pagedMessages = relevantMessages.slice(start, start + MESSAGES_PER_PAGE);
  const hasPrev = page > 0;
  const hasNext = start + MESSAGES_PER_PAGE < totalMessages;

  return {
    messages: pagedMessages,
    hasNext,
    hasPrev,
    page,
    totalMessages,
  };
}

function formatRoleIcon(role: "user" | "assistant"): string {
  return role === "user" ? "👤" : "🤖";
}

function formatTimestamp(timestamp: number, localeForDate: string): string {
  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString(localeForDate, {
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString(localeForDate, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateStr} ${timeStr}`;
}

function formatMessagesHeader(page: number, totalMessages: number): string {
  const from = page * MESSAGES_PER_PAGE + 1;
  const to = Math.min((page + 1) * MESSAGES_PER_PAGE, totalMessages);
  return t("messages.header", { from, to, total: totalMessages });
}

function formatMessageItem(index: number, msg: MessageItem, localeForDate: string): string {
  const icon = formatRoleIcon(msg.role);
  const timestamp = formatTimestamp(msg.timestamp, localeForDate);
  return `${index + 1}. ${icon} ${msg.text}\n   └ ${timestamp}`;
}

function buildMessagesKeyboard(pageData: MessagesPage): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (let i = 0; i < pageData.messages.length; i++) {
    const msg = pageData.messages[i];
    keyboard
      .text(t("messages.button.fork"), `${MESSAGES_FORK_PREFIX}${msg.messageID}`)
      .text(t("messages.button.revert"), `${MESSAGES_REVERT_PREFIX}${msg.messageID}`)
      .row();
  }

  if (pageData.hasPrev || pageData.hasNext) {
    if (pageData.hasPrev) {
      keyboard.text(t("messages.button.prev"), `${MESSAGES_PAGE_PREFIX}${pageData.page - 1}`);
    }
    if (pageData.hasNext) {
      keyboard.text(t("messages.button.next"), `${MESSAGES_PAGE_PREFIX}${pageData.page + 1}`);
    }
    keyboard.row();
  }
  keyboard.text(t("messages.button.cancel"), MESSAGES_CANCEL);

  return keyboard;
}

export async function messagesCommand(ctx: CommandContext<Context>) {
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply(t("messages.error_no_session"));
      return;
    }

    const session = getCurrentSession(chatId);
    if (!session) {
      await ctx.reply(t("messages.no_session"));
      return;
    }

    const project = getCurrentProject(chatId);
    if (!project) {
      await ctx.reply(t("messages.no_project"));
      return;
    }

    logger.debug(`[Messages] Loading messages for session: ${session.id}`);

    const pageData = await loadMessagesPage(session.id, project.worktree, 0);

    if (pageData.messages.length === 0) {
      await ctx.reply(t("messages.empty"));
      return;
    }

    const localeForDate = getDateLocale();
    const header = formatMessagesHeader(0, pageData.totalMessages);
    const messageLines = pageData.messages.map((msg, i) =>
      formatMessageItem(i, msg, localeForDate),
    );
    const text = [header, "", ...messageLines].join("\n");

    const keyboard = buildMessagesKeyboard(pageData);

    const message = await ctx.reply(text, { reply_markup: keyboard });

    interactionManager.start(chatId, {
      kind: "custom",
      expectedInput: "callback",
      metadata: {
        flow: "messages",
        stage: "list",
        messageId: message.message_id,
        sessionId: session.id,
        directory: project.worktree,
        messages: pageData.messages,
        page: 0,
        totalMessages: pageData.totalMessages,
      },
    });

    logger.info(`[Messages] Command executed for session: ${session.id}`);
  } catch (error) {
    logger.error("[Messages] Error loading messages:", error);
    await ctx.reply(t("messages.error_load"));
  }
}

export async function handleMessagesCallback(ctx: Context): Promise<boolean> {
  const callbackQuery = ctx.callbackQuery;
  if (!callbackQuery?.data || !callbackQuery.data.startsWith(MESSAGES_CALLBACK_PREFIX)) {
    return false;
  }

  const chatId = ctx.chat?.id ?? 0;
  const state = interactionManager.getSnapshot(chatId);

  if (!state || state.kind !== "custom" || state.metadata.flow !== "messages") {
    await ctx.answerCallbackQuery({ text: t("messages.inactive_callback") });
    return true;
  }

  const metadata = state.metadata as unknown as MessagesMetadata;
  const callbackMessageId = (ctx.callbackQuery?.message as { message_id?: number })?.message_id;

  if (callbackMessageId !== metadata.messageId) {
    await ctx.answerCallbackQuery({ text: t("messages.inactive_callback") });
    return true;
  }

  const data = callbackQuery.data;

  try {
    if (data === MESSAGES_CANCEL) {
      interactionManager.clear(chatId, "messages_cancelled");
      await ctx.answerCallbackQuery({ text: t("messages.cancelled_callback") });
      await ctx.deleteMessage().catch(() => {});
      return true;
    }

    const page = parseMessagesPageCallback(data);
    if (page !== null) {
      const pageData = await loadMessagesPage(metadata.sessionId, metadata.directory, page);
      if (pageData.messages.length === 0) {
        await ctx.answerCallbackQuery({ text: t("messages.empty") });
        return true;
      }

      const localeForDate = getDateLocale();
      const header = formatMessagesHeader(page, pageData.totalMessages);
      const messageLines = pageData.messages.map((msg, i) =>
        formatMessageItem(i, msg, localeForDate),
      );
      const text = [header, "", ...messageLines].join("\n");

      const keyboard = buildMessagesKeyboard(pageData);

      await ctx.editMessageText(text, { reply_markup: keyboard });
      await ctx.answerCallbackQuery();

      interactionManager.transition(chatId, {
        expectedInput: "callback",
        metadata: {
          ...metadata,
          messages: pageData.messages,
          page,
        },
      });
      return true;
    }

    const forkMsgId = parseForkCallback(data);
    if (forkMsgId !== null) {
      await ctx.answerCallbackQuery({ text: t("messages.forking") });

      const { data: forkResult, error } = await opencodeClient.session.fork({
        sessionID: metadata.sessionId,
        directory: metadata.directory,
        messageID: forkMsgId,
      });

      if (error || !forkResult) {
        logger.error("[Messages] Fork failed:", error);
        await ctx.reply(t("messages.fork_error"));
        return true;
      }

      logger.info(`[Messages] Session forked: ${metadata.sessionId} at message ${forkMsgId}`);
      await ctx.reply(t("messages.fork_success", { newSessionId: forkResult.id ?? "unknown" }));
      interactionManager.clear(chatId, "messages_forked");
      await ctx.deleteMessage().catch(() => {});
      return true;
    }

    const revertMsgId = parseRevertCallback(data);
    if (revertMsgId !== null) {
      await ctx.answerCallbackQuery({ text: t("messages.reverting") });

      const { data: revertResult, error } = await opencodeClient.session.revert({
        sessionID: metadata.sessionId,
        directory: metadata.directory,
        messageID: revertMsgId,
      });

      if (error || !revertResult) {
        logger.error("[Messages] Revert failed:", error);
        await ctx.reply(t("messages.revert_error"));
        return true;
      }

      logger.info(`[Messages] Session reverted: ${metadata.sessionId} to message ${revertMsgId}`);
      await ctx.reply(t("messages.revert_success"));
      interactionManager.clear(chatId, "messages_reverted");
      await ctx.deleteMessage().catch(() => {});
      return true;
    }

    await ctx.answerCallbackQuery({ text: t("callback.unknown_command") });
    return true;
  } catch (error) {
    logger.error("[Messages] Callback error:", error);
    interactionManager.clear(chatId, "messages_callback_error");
    await ctx.answerCallbackQuery({ text: t("callback.processing_error") });
    return true;
  }
}
