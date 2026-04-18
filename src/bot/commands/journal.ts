import { CommandContext, Context } from "grammy";
import { logger } from "../../utils/logger.js";
import { escapeHtml } from "../../utils/html.js";
import { t } from "../../i18n/index.js";
import { getJournalErrors } from "../../monitoring/journal-monitor.js";

export async function journalCommand(ctx: CommandContext<Context>) {
  const args = (ctx.match as string)?.trim() || "";
  const isWatchMode = args.toLowerCase() === "watch" || args.toLowerCase() === "start";

  if (isWatchMode) {
    await ctx.reply(t("journal.watch_started"), { parse_mode: "HTML" });
    return;
  }

  const statusMsg = await ctx.reply(t("journal.fetching"), {
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
      t("journal.error", { message: safeMessage }),
      { parse_mode: "HTML" }
    ).catch(() => {});
  }
}
