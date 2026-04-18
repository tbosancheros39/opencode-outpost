import { CommandContext, Context, InlineKeyboard } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentSession, setCurrentSession, type SessionInfo } from "../../session/manager.js";
import { getStoredAgent } from "../../agent/manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { logger } from "../../utils/logger.js";
import { escapeHtml } from "../../utils/html.js";
import { t } from "../../i18n/index.js";
import { chunkOutput } from "../utils/chunk.js";
import {
  classifyCommand,
  requiresConfirmation,
  formatWarningMessage,
} from "../../safety/command-classifier.js";
import {
  storePendingCommand,
  getPendingCommand,
  removePendingCommand,
} from "../../safety/pending-commands.js";
import { extractShellOutput } from "../utils/shell-security.js";

export async function shellCommand(ctx: CommandContext<Context>) {
  if (!ctx.chat) {
    return;
  }

  const command = (ctx.match as string)?.trim();

  if (!command) {
    await ctx.reply(t("shell.usage"), {
      parse_mode: "HTML",
    });
    return;
  }

  // Check if this is a callback confirmation
  if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
    const callbackData = (ctx.callbackQuery as { data?: string }).data;
    if (callbackData?.startsWith("shell:exec:")) {
      const messageId = parseInt(callbackData.split(":")[2], 10);
      const pending = getPendingCommand(messageId);

      if (!pending) {
        await ctx.answerCallbackQuery({ text: t("shell.expired") });
        return;
      }

      await ctx.answerCallbackQuery({ text: t("shell.executing") });
      await executeShellCommand(ctx, pending.command, messageId);
      removePendingCommand(messageId);
      return;
    }

    if (callbackData?.startsWith("shell:cancel:")) {
      const messageId = parseInt(callbackData.split(":")[2], 10);
      removePendingCommand(messageId);
      await ctx.answerCallbackQuery({ text: t("shell.cancelled") });
      await ctx.editMessageText(t("shell.cancelled_msg"));
      return;
    }
  }

  // Classify the command
  const classification = classifyCommand(command);

  // If dangerous, require confirmation
  if (requiresConfirmation(classification)) {
    const warningMsg = formatWarningMessage(command, classification);
    const message = await ctx.reply(warningMsg, {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("✅ Execute", `shell:exec:${ctx.message?.message_id || Date.now()}`)
        .text("❌ Cancel", `shell:cancel:${ctx.message?.message_id || Date.now()}`),
    });

    // Store for later execution
    const chatId = ctx.chat?.id ?? 0;
    const session = getCurrentSession(chatId);
    if (session) {
      storePendingCommand(message.message_id, command, session.id, ctx);
    }

    return;
  }

  // For warnings, show notice but proceed
  if (classification.level === "warning") {
    logger.warn(`[Shell] Warning: ${classification.reason} for command: ${command}`);
  }

  // Execute immediately for safe commands
  await executeShellCommand(ctx, command);
}

async function executeShellCommand(
  ctx: CommandContext<Context>,
  command: string,
  messageId?: number,
) {
  if (!ctx.chat) {
    return;
  }

  const chatId = ctx.chat.id;

  const statusMsg = messageId
    ? { message_id: messageId }
    : await ctx.reply(t("shell.running", { command: escapeHtml(command) }), {
        parse_mode: "HTML",
      });

  const startTime = Date.now();
  const PROGRESS_INTERVAL_MS = 15000;

  const progressInterval = setInterval(async () => {
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    const elapsedStr =
      elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;
    try {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        t("shell.running_elapsed", { command: escapeHtml(command), elapsed: elapsedStr }),
        { parse_mode: "HTML" },
      );
    } catch {
      clearInterval(progressInterval);
    }
  }, PROGRESS_INTERVAL_MS);

  try {
    let session = getCurrentSession(chatId);
    if (!session) {
      const currentProject = getCurrentProject(chatId);
      const { data: newSession, error } = await opencodeClient.session.create({
        directory: currentProject?.worktree ?? "",
      });
      if (error || !newSession) {
        throw error || new Error("Failed to create session");
      }

      const sessionInfo: SessionInfo = {
        id: newSession.id,
        title: newSession.title,
        directory: newSession.directory || "",
      };
      setCurrentSession(chatId, sessionInfo);
      session = sessionInfo;
    }

    const currentAgent = getStoredAgent(chatId) ?? "build";
    const { data, error } = await opencodeClient.session.shell({
      sessionID: session.id,
      command,
      agent: currentAgent,
    });

    if (error) {
      if (error instanceof Error) {
        throw error;
      }
      let message: string;
      if (typeof error === "string") {
        message = error;
      } else if ("data" in error && typeof error.data === "object" && error.data !== null) {
        const data = error.data as { message?: string };
        message = data.message || JSON.stringify(error);
      } else {
        message = JSON.stringify(error);
      }
      throw new Error(message);
    }

    const rawOutput = extractShellOutput(data, "Command executed (no output).");

    const chunks = chunkOutput(rawOutput);

    clearInterval(progressInterval);

    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    const elapsedStr =
      elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;

    await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

    for (let i = 0; i < chunks.length; i++) {
      const header =
        chunks.length > 1
          ? t("shell.output_part", { part: String(i + 1), total: String(chunks.length), elapsed: elapsedStr })
          : t("shell.output", { elapsed: elapsedStr });
      await ctx.reply(`${header}\n<pre><code>${chunks[i]}</code></pre>`, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    clearInterval(progressInterval);
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[Bot] Shell command error:", error);
    await ctx.api
      .editMessageText(
        chatId,
        statusMsg.message_id,
        t("shell.error", { message: escapeHtml(message) }),
        { parse_mode: "HTML" },
      )
      .catch(() => {});
  }
}

export async function handleShellCallback(ctx: Context): Promise<boolean> {
  const callbackData = ctx.callbackQuery?.data;

  if (!callbackData) {
    return false;
  }

  if (callbackData.startsWith("shell:exec:") || callbackData.startsWith("shell:cancel:")) {
    // Re-use the shellCommand logic
    await shellCommand(ctx as CommandContext<Context>);
    return true;
  }

  return false;
}
