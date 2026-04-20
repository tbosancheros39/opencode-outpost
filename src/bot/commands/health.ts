import { CommandContext, Context } from "grammy";
import { t } from "../../i18n/index.js";
import { manualHealthCheck } from "../../monitoring/system-monitor.js";

export async function healthCommand(ctx: CommandContext<Context>) {
  if (!ctx.chat) {
    return;
  }

  const chatId = ctx.chat.id;
  const statusMsg = await ctx.reply(t("health.checking"));

  try {
    const result = await manualHealthCheck(chatId);
    await ctx.api.deleteMessage(chatId, statusMsg.message_id);
    await ctx.reply(result, { parse_mode: "HTML" });
  } catch {
    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      t("health.error")
    );
  }
}
