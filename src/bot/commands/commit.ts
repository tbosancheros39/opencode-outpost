import { CommandContext, Context } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentSession, setCurrentSession, type SessionInfo } from "../../session/manager.js";
import { getStoredAgent } from "../../agent/manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { logger } from "../../utils/logger.js";
import { escapeHtml } from "../../utils/html.js";
import { t } from "../../i18n/index.js";
import { chunkOutput } from "../utils/chunk.js";
import { quoteShellArg, extractShellOutput } from "../utils/shell-security.js";

export async function commitCommand(ctx: CommandContext<Context>) {
  if (!ctx.chat) {
    return;
  }

  const message = (ctx.match as string)?.trim();
  const chatId = ctx.chat.id;

  if (!message) {
    await ctx.reply(t("git.commit.usage"), {
      parse_mode: "HTML",
    });
    return;
  }

  const statusMsg = await ctx.reply(t("git.commit.committing"), {
    parse_mode: "HTML",
  });

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
      command: `git commit -m ${quoteShellArg(message)}`,
      agent: currentAgent,
    });

    if (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    const rawOutput = extractShellOutput(data, t("git.commit.success"));
    const chunks = chunkOutput(rawOutput || t("git.commit.success"));

    await ctx.api.deleteMessage(chatId, statusMsg.message_id);

    for (let i = 0; i < chunks.length; i++) {
      const header =
        chunks.length > 1
          ? t("git.commit.header_part", { part: String(i + 1), total: String(chunks.length) })
          : t("git.commit.header");
      await ctx.reply(`${header}\n<pre><code>${chunks[i]}</code></pre>`, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    logger.error("[Bot] Commit command error:", error);
    await ctx.api
      .editMessageText(
        chatId,
        statusMsg.message_id,
        t("git.commit.error", { message: escapeHtml(errMessage) }),
        { parse_mode: "HTML" },
      )
      .catch(() => {});
  }
}
