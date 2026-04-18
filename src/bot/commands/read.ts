import { CommandContext, Context } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentSession, setCurrentSession, type SessionInfo } from "../../session/manager.js";
import { getStoredAgent } from "../../agent/manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { logger } from "../../utils/logger.js";
import { escapeHtml } from "../../utils/html.js";
import { chunkOutput } from "../utils/chunk.js";
import { quoteShellArg, validateShellPathInput, extractShellOutput } from "../utils/shell-security.js";

export async function readCommand(ctx: CommandContext<Context>) {
  if (!ctx.chat) {
    return;
  }

  const targetFile = (ctx.match as string)?.trim();
  const chatId = ctx.chat.id;

  if (!targetFile) {
    await ctx.reply("⚠️ Please provide a file path.\nUsage: <code>/read src/index.ts</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  const pathValidationError = validateShellPathInput(targetFile);
  if (pathValidationError) {
    await ctx.reply(`⚠️ ${pathValidationError}`, { parse_mode: "HTML" });
    return;
  }

  const statusMsg = await ctx.reply(`📄 <i>Reading: ${escapeHtml(targetFile)}...</i>`, {
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
      command: `cat ${quoteShellArg(targetFile)}`,
      agent: currentAgent,
    });

    if (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    const rawOutput = extractShellOutput(data, "");
    const chunks = chunkOutput(rawOutput || "(empty file)");

    await ctx.api.deleteMessage(chatId, statusMsg.message_id);

    for (let i = 0; i < chunks.length; i++) {
      const header =
        chunks.length > 1
          ? `📄 <b>${escapeHtml(targetFile)} (Part ${i + 1}/${chunks.length}):</b>\n`
          : `📄 <b>${escapeHtml(targetFile)}:</b>\n`;
      await ctx.reply(`${header}<pre><code>${chunks[i]}</code></pre>`, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[Bot] Read command error:", error);
    await ctx.api
      .editMessageText(
        chatId,
        statusMsg.message_id,
        `❌ <b>Error reading file:</b>\n<pre>${escapeHtml(message)}</pre>`,
        { parse_mode: "HTML" },
      )
      .catch(() => {});
  }
}
