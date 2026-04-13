import { CommandContext, Context } from "grammy";
import { manualHealthCheck } from "../../monitoring/system-monitor.js";

export async function healthCommand(ctx: CommandContext<Context>) {
  if (!ctx.chat) {
    return;
  }

  const chatId = ctx.chat.id;
  const statusMsg = await ctx.reply("📊 Checking system health...");
  
  try {
    const result = await manualHealthCheck(chatId);
    await ctx.api.deleteMessage(chatId, statusMsg.message_id);
    await ctx.reply(result, { parse_mode: "HTML" });
  } catch {
    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      "❌ Failed to check system health."
    );
  }
}
