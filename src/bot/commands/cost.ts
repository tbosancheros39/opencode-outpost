import { CommandContext, Context } from "grammy";
import { pinnedMessageManager } from "../../pinned/manager.js";
import { logger } from "../../utils/logger.js";
import { getCostHistory, addCostEntry, type CostEntry } from "../../settings/manager.js";

function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getWeekEntries(entries: CostEntry[]): CostEntry[] {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekKey = weekAgo.toISOString().slice(0, 10);
  return entries.filter((e) => e.date >= weekKey);
}

export async function costCommand(ctx: CommandContext<Context>) {
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply("❌ Unable to identify chat.");
      return;
    }

    const state = pinnedMessageManager.getState(chatId);

    // Record current session cost to history if we have a session
    if (state.sessionId && (state.cost ?? 0) > 0) {
      addCostEntry(chatId, {
        date: getTodayKey(),
        sessionId: state.sessionId,
        cost: state.cost ?? 0,
        tokensIn: state.tokensUsed,
        tokensOut: 0,
        model: state.projectName || "unknown",
      });
    }

    // Re-read history after recording
    const updatedHistory = getCostHistory(chatId);
    const todayKey = getTodayKey();
    const todayEntries = updatedHistory.filter((e) => e.date === todayKey);
    const weekEntries = getWeekEntries(updatedHistory);

    const todayCost = todayEntries.reduce((sum, e) => sum + e.cost, 0);
    const todayTokensIn = todayEntries.reduce((sum, e) => sum + e.tokensIn, 0);
    const weekCost = weekEntries.reduce((sum, e) => sum + e.cost, 0);
    const weekDays = new Set(weekEntries.map((e) => e.date)).size || 1;
    const avgPerDay = weekCost / weekDays;

    const lines = [
      "💰 <b>Cost &amp; Usage Report</b>",
      "",
      "📊 <b>Current Session:</b>",
      `  Tokens: ${formatTokenCount(state.tokensUsed)} / ${formatTokenCount(state.tokensLimit)}`,
      `  Cost: $${(state.cost || 0).toFixed(2)}`,
      "",
      "📅 <b>Today:</b>",
      `  Sessions: ${todayEntries.length}`,
      `  Total tokens: ${formatTokenCount(todayTokensIn)}`,
      `  Total cost: $${todayCost.toFixed(2)}`,
      "",
      "📆 <b>This Week:</b>",
      `  Total cost: $${weekCost.toFixed(2)}`,
      `  Avg per day: $${avgPerDay.toFixed(2)}`,
    ];

    // Model breakdown from today's entries
    const modelCosts = new Map<string, number>();
    for (const entry of todayEntries) {
      const model = entry.model || "unknown";
      modelCosts.set(model, (modelCosts.get(model) || 0) + entry.cost);
    }

    if (modelCosts.size > 0) {
      lines.push("", "🏷️ <b>By Model (Today):</b>");
      for (const [model, cost] of modelCosts) {
        const percent = todayCost > 0 ? Math.round((cost / todayCost) * 100) : 0;
        lines.push(`  ${model}: $${cost.toFixed(2)} (${percent}%)`);
      }
    }

    await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });

    logger.info(`[Cost] Cost report sent for chat ${chatId}`);
  } catch (error) {
    logger.error("[Bot] Cost command error:", error);
    await ctx.reply("❌ Failed to generate cost report.").catch(() => {});
  }
}
