import { CommandContext, Context } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentSession, setCurrentSession, type SessionInfo } from "../../session/manager.js";
import { getStoredAgent } from "../../agent/manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { logger } from "../../utils/logger.js";
import { escapeHtml } from "../../utils/html.js";
import { chunkOutput } from "../utils/chunk.js";
import { extractShellOutput } from "../utils/shell-security.js";

export async function logsCommand(ctx: CommandContext<Context>) {
  if (!ctx.chat) {
    return;
  }

  const chatId = ctx.chat.id;
  const service = ((ctx.match as string)?.trim() || "syslog").replace(/[<>&;|]/g, "");

  // Validate service name (alphanumeric, dash, dot only)
  if (!/^[a-zA-Z0-9_.-]+$/.test(service) && service !== "syslog") {
    await ctx.reply(
      "⚠️ Invalid service name. Use only letters, numbers, dots, dashes, and underscores.\n" +
        "Examples: <code>/logs nginx</code>, <code>/logs ssh</code>, <code>/logs syslog</code>",
      { parse_mode: "HTML" },
    );
    return;
  }

  const statusMsg = await ctx.reply(`📋 <i>Fetching logs for: <code>${service}</code>...</i>`, {
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

    // Build the appropriate command based on service
    let command: string;
    if (service === "syslog") {
      command = "journalctl --no-pager -n 50";
    } else {
      command = `journalctl -u ${service} --no-pager -n 50`;
    }

    const currentAgent = getStoredAgent(chatId) ?? "build";
    const { data, error } = await opencodeClient.session.shell({
      sessionID: session.id,
      command,
      agent: currentAgent,
    });

    if (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    const rawOutput = extractShellOutput(data, "No logs found.");

    const chunks = chunkOutput(rawOutput);

    await ctx.api.deleteMessage(chatId, statusMsg.message_id);

    for (let i = 0; i < chunks.length; i++) {
      const header =
        chunks.length > 1
          ? `📋 <b>Logs for ${service} (${i + 1}/${chunks.length}):</b>\n`
          : `📋 <b>Logs for ${service}:</b>\n`;
      await ctx.reply(`${header}<pre><code>${chunks[i]}</code></pre>`, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[Bot] Logs command error:", error);
    await ctx.api
      .editMessageText(
        chatId,
        statusMsg.message_id,
        `❌ <b>Error:</b>\n<pre>${escapeHtml(message)}</pre>`,
        { parse_mode: "HTML" },
      )
      .catch(() => {});
  }
}
