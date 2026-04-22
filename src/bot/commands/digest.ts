import { CommandContext, Context } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentProject } from "../../settings/manager.js";
import { getCurrentSession } from "../../session/manager.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import { chunkOutput } from "../utils/chunk.js";
import { sendBotText } from "../utils/telegram-text.js";

const MESSAGE_CHUNK_SIZE = 4000;

/**
 * /digest command — context summary
 * Uses existing summaryAggregator singleton (don't create a parallel aggregator)
 */
export async function digestCommand(ctx: CommandContext<Context>): Promise<void> {
  const args = ctx.match?.toString().trim() ?? "";
  const chatId = ctx.chat?.id ?? 0;

  const currentProject = getCurrentProject(chatId);
  if (!currentProject) {
    await ctx.reply(t("bot.project_not_selected"));
    return;
  }

  const currentSession = getCurrentSession(chatId);
  if (!currentSession) {
    await ctx.reply(t("cmd.digest.no_session"));
    return;
  }

  try {
    await ctx.reply(t("cmd.digest.generating"));

    // Use summaryAggregator to get aggregated context
    // The aggregator already processes events — we use its internal state
    const summaryText = await generateDigest(
      currentSession.id,
      currentSession.title,
      currentProject.worktree,
      args,
    );

    if (!summaryText) {
      await ctx.reply(t("cmd.digest.empty"));
      return;
    }

    const chunks = chunkOutput(summaryText, MESSAGE_CHUNK_SIZE);

    for (let i = 0; i < chunks.length; i++) {
      const prefix = i === 0 ? t("cmd.digest.header", { title: currentSession.title }) : "";
      await sendBotText({
        api: ctx.api,
        chatId,
        text: `${prefix}${chunks[i]}`,
      });
    }

    logger.info(`[Digest] Generated digest for session ${currentSession.id}`);
  } catch (error) {
    logger.error("[Digest] Error generating digest:", error);
    await ctx.reply(t("cmd.digest.error"));
  }
}

/**
 * Generate a digest of the session context
 * Uses session.get() to fetch full session data (not SSE timeout)
 */
async function generateDigest(
  sessionId: string,
  sessionTitle: string,
  worktree: string,
  focus?: string,
): Promise<string | null> {
  try {
    const { data: session, error } = await opencodeClient.session.get({
      sessionID: sessionId,
      directory: worktree,
    });

    if (error || !session) {
      logger.warn("[Digest] Failed to get session:", error);
      return null;
    }

    // Extract messages from session data
    const messages: DigestMessage[] = [];

    // Session object contains conversation context
    // Format depends on SDK response structure
    if (Array.isArray(session)) {
      for (const item of session) {
        if (item.role && item.text) {
          messages.push({
            role: item.role,
            text: item.text,
            created: item.time?.created ?? Date.now(),
          });
        }
      }
    }

    if (messages.length === 0) {
      return null;
    }

    return formatDigest(sessionTitle, messages, focus);
  } catch (err) {
    logger.error("[Digest] Error generating digest:", err);
    return null;
  }
}

interface DigestMessage {
  role: string;
  text: string;
  created: number;
}

function formatDigest(
  sessionTitle: string,
  messages: DigestMessage[],
  focus?: string,
): string {
  const lines: string[] = [];

  lines.push(`# ${sessionTitle}`);
  lines.push("");

  if (focus) {
    lines.push(`**Focus**: ${focus}`);
    lines.push("");
  }

  // Summary statistics
  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");

  lines.push(`**Messages**: ${messages.length} total (${userMessages.length} user, ${assistantMessages.length} assistant)`);
  lines.push("");

  // Recent exchanges
  lines.push("## Recent Conversation");
  lines.push("");

  const recentMessages = messages.slice(-20);
  recentMessages.forEach((msg) => {
    const role = msg.role === "user" ? "**You**" : "**Assistant**";
    const truncated = msg.text.length > 200 ? `${msg.text.slice(0, 197)}...` : msg.text;
    lines.push(`${role}: ${truncated}`);
    lines.push("");
  });

  // If focus is specified, highlight relevant messages
  if (focus) {
    const focusLower = focus.toLowerCase();
    const relevantMessages = messages.filter((m) =>
      m.text.toLowerCase().includes(focusLower),
    );

    if (relevantMessages.length > 0) {
      lines.push(`## Related to "${focus}"`);
      lines.push("");

      relevantMessages.slice(-10).forEach((msg) => {
        const role = msg.role === "user" ? "**You**" : "**Assistant**";
        const truncated = msg.text.length > 200 ? `${msg.text.slice(0, 197)}...` : msg.text;
        lines.push(`${role}: ${truncated}`);
        lines.push("");
      });
    }
  }

  return lines.join("\n");
}
