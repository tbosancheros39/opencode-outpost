import { CommandContext, Context } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentSession, setCurrentSession, type SessionInfo } from "../../session/manager.js";
import { getStoredAgent } from "../../agent/manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { logger } from "../../utils/logger.js";
import { escapeHtml } from "../../utils/html.js";
import { t } from "../../i18n/index.js";
import { chunkOutput } from "../utils/chunk.js";
import { quoteShellArg, validateShellPathInput, extractShellOutput } from "../utils/shell-security.js";

export async function diffCommand(ctx: CommandContext<Context>) {
  if (!ctx.chat) {
    return;
  }

  const targetPath = (ctx.match as string)?.trim() || "";
  const chatId = ctx.chat.id;

  // Validate path if provided
  if (targetPath) {
    const pathValidationError = validateShellPathInput(targetPath);
    if (pathValidationError) {
      await ctx.reply(`⚠️ ${pathValidationError}`, { parse_mode: "HTML" });
      return;
    }
  }

  const statusMsg = await ctx.reply(t("git.diff.checking"), {
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
    const gitCommand = targetPath
      ? `git diff ${quoteShellArg(targetPath)}`
      : "git diff";
    const { data, error } = await opencodeClient.session.shell({
      sessionID: session.id,
      command: gitCommand,
      agent: currentAgent,
    });

    if (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    const rawOutput = extractShellOutput(data, "");

    // If no output, check staged changes
    if (!rawOutput || rawOutput.trim() === "") {
      const { data: stagedData, error: stagedError } = await opencodeClient.session.shell({
        sessionID: session.id,
        command: "git diff --staged",
        agent: currentAgent,
      });

      if (stagedError) {
        throw stagedError instanceof Error ? stagedError : new Error(String(stagedError));
      }

      const stagedOutput = extractShellOutput(stagedData, "");

      if (!stagedOutput || stagedOutput.trim() === "") {
        await ctx.api.editMessageText(
          chatId,
          statusMsg.message_id,
          t("git.diff.no_changes"),
          { parse_mode: "HTML" },
        );
        return;
      }

      const chunks = chunkOutput(stagedOutput);
      await ctx.api.deleteMessage(chatId, statusMsg.message_id);

      for (let i = 0; i < chunks.length; i++) {
        const header =
          chunks.length > 1
            ? t("git.diff.staged_header_part", { part: String(i + 1), total: String(chunks.length) })
            : t("git.diff.staged_header");
        await ctx.reply(`${header}\n<pre><code>${chunks[i]}</code></pre>`, {
          parse_mode: "HTML",
        });
      }
      return;
    }

    const chunks = chunkOutput(rawOutput);
    await ctx.api.deleteMessage(chatId, statusMsg.message_id);

    for (let i = 0; i < chunks.length; i++) {
      const header =
        chunks.length > 1
          ? t("git.diff.header_part", { part: String(i + 1), total: String(chunks.length) })
          : t("git.diff.header");
      await ctx.reply(`${header}\n<pre><code>${chunks[i]}</code></pre>`, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[Bot] Diff command error:", error);
    await ctx.api
      .editMessageText(
        chatId,
        statusMsg.message_id,
        t("git.diff.error", { message: escapeHtml(message) }),
        { parse_mode: "HTML" },
      )
      .catch(() => {});
  }
}
