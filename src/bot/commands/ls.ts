import { CommandContext, Context } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentSession, setCurrentSession, type SessionInfo } from "../../session/manager.js";
import { getStoredAgent } from "../../agent/manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { logger } from "../../utils/logger.js";
import { escapeHtml } from "../../utils/html.js";
import { chunkOutput } from "../utils/chunk.js";
import { quoteShellArg, validateShellPathInput, extractShellOutput } from "../utils/shell-security.js";

export async function lsCommand(ctx: CommandContext<Context>) {
  if (!ctx.chat) {
    return;
  }

  const targetPath = (ctx.match as string)?.trim() || ".";
  const chatId = ctx.chat.id;
  const pathValidationError = validateShellPathInput(targetPath);

  if (pathValidationError) {
    await ctx.reply(`⚠️ ${pathValidationError}`, { parse_mode: "HTML" });
    return;
  }

  const statusMsg = await ctx.reply(`📂 <i>Listing: ${escapeHtml(targetPath)}...</i>`, {
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
      command: `ls -la ${quoteShellArg(targetPath)}`,
      agent: currentAgent,
    });

    if (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    const rawOutput = extractShellOutput(data, "(empty directory)");

    const chunks = chunkOutput(rawOutput);

    await ctx.api.deleteMessage(chatId, statusMsg.message_id);

    for (let i = 0; i < chunks.length; i++) {
      await ctx.reply(`📂 <b>${escapeHtml(targetPath)}</b>\n<pre><code>${chunks[i]}</code></pre>`, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[Bot] LS command error:", error);
    await ctx.api
      .editMessageText(
        chatId,
        statusMsg.message_id,
        `❌ <b>Error listing directory:</b>\n<pre>${escapeHtml(message)}</pre>`,
        { parse_mode: "HTML" },
      )
      .catch(() => {});
  }
}
