import { CommandContext, Context } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentSession, setCurrentSession, type SessionInfo } from "../../session/manager.js";
import { getStoredAgent } from "../../agent/manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { logger } from "../../utils/logger.js";
import { escapeHtml } from "../../utils/html.js";
import { t } from "../../i18n/index.js";
import { chunkOutput } from "../utils/chunk.js";
import { extractShellOutput } from "../utils/shell-security.js";

export async function branchCommand(ctx: CommandContext<Context>) {
  if (!ctx.chat) {
    return;
  }

  const args = (ctx.match as string)?.trim() || "";
  const chatId = ctx.chat.id;

  const statusMsg = await ctx.reply(t("git.branch.checking"), {
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
    const gitCommand = args ? `git branch ${args}` : "git branch -vv";
    const { data, error } = await opencodeClient.session.shell({
      sessionID: session.id,
      command: gitCommand,
      agent: currentAgent,
    });

    if (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    const rawOutput = extractShellOutput(data, t("git.branch.empty"));
    const chunks = chunkOutput(rawOutput || t("git.branch.empty"));

    await ctx.api.deleteMessage(chatId, statusMsg.message_id);

    for (let i = 0; i < chunks.length; i++) {
      const header =
        chunks.length > 1
          ? t("git.branch.header_part", { part: String(i + 1), total: String(chunks.length) })
          : t("git.branch.header");
      await ctx.reply(`${header}\n<pre><code>${chunks[i]}</code></pre>`, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[Bot] Branch command error:", error);
    await ctx.api
      .editMessageText(
        chatId,
        statusMsg.message_id,
        t("git.branch.error", { message: escapeHtml(message) }),
        { parse_mode: "HTML" },
      )
      .catch(() => {});
  }
}
