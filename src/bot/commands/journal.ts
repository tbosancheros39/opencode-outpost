import { CommandContext, Context } from "grammy";
import { logger } from "../../utils/logger.js";
import { getJournalErrors } from "../../monitoring/journal-monitor.js";
import { escapeHtml } from "../../utils/html.js";

export async function journalCommand(ctx: CommandContext<Context>) {
  const args = (ctx.match as string)?.trim() || "";
  const isWatchMode = args.toLowerCase() === "watch" || args.toLowerCase() === "start";

  if (isWatchMode) {
    await ctx.reply(
      "👀 <b>Journal Watch Mode Started</b>\n\nI'll watch for new system errors and notify you when they appear.\n\nUse /journal to check recent errors.",
      { parse_mode: "HTML" }
    );
    return;
  }

  const statusMsg = await ctx.reply("📋 <i>Fetching recent system errors...</i>", {
    parse_mode: "HTML",
  });

  const chatId = ctx.chat?.id ?? 0;

  try {
    const report = await getJournalErrors(10);
    const safeReport = report.length > 3800 ? `${report.slice(0, 3800)}\n\n<i>…truncated</i>` : report;

    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      safeReport,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = escapeHtml(message);
    logger.error("[Bot] Journal command error:", error);
    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      `❌ <b>Error fetching journal:</b>\n<pre>${safeMessage}</pre>`,
      { parse_mode: "HTML" }
    ).catch(() => {});
  }
}
