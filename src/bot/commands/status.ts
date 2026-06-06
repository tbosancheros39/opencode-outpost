import { CommandContext, Context } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import {
  checkRedisHealth,
  checkOpencodeHealth,
} from "../../monitoring/health-probes.js";
import { getQueue } from "../../queue/queue.js";
import { memoryQueue } from "../../queue/memory-queue.js";
import { getCurrentSession } from "../../session/manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { fetchCurrentAgent } from "../../agent/manager.js";
import { getAgentDisplayName } from "../../agent/types.js";
import { fetchCurrentModel } from "../../model/manager.js";
import { processManager } from "../../process/manager.js";
import { keyboardManager } from "../../keyboard/manager.js";
import { pinnedMessageManager } from "../../pinned/manager.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import { sendBotText } from "../utils/telegram-text.js";

export async function statusCommand(ctx: CommandContext<Context>) {
  try {
    const { data, error } = await opencodeClient.global.health();

    if (error || !data) {
      throw error || new Error("No data received from server");
    }

    let message = `${t("status.header_running")}\n\n`;
    const healthLabel = data.healthy
      ? t("status.health.healthy")
      : t("status.health.unhealthy");
    message += `${t("status.line.health", { health: healthLabel })}\n`;
    if (data.version) {
      message += `${t("status.line.version", { version: data.version })}\n`;
    }

    // Add Redis health information
    const redisHealth = await checkRedisHealth();
    if (redisHealth.skipped) {
      message += `${t("status.redis.skipped")}\n`;
    } else if (redisHealth.ok) {
      message += `${t("status.redis.connected", { latencyMs: redisHealth.latencyMs ?? 0 })}\n`;
    } else {
      message += `${t("status.redis.down")}\n`;
    }

    // Add queue statistics
    try {
      const queue = getQueue();
      if (queue) {
        const [waiting, active] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
        ]);
        message += `${t("status.queue.stats", { pending: waiting.length, active: active.length })}\n`;
      } else if (memoryQueue.getPendingCount() > 0) {
        message += `${t("status.queue.stats", { pending: memoryQueue.getPendingCount(), active: 0 })}\n`;
      }
    } catch {
      logger.warn("[Status] Could not fetch queue stats");
    }

    // Add process management information
    if (processManager.isRunning()) {
      const uptime = processManager.getUptime();
      const uptimeStr = uptime ? Math.floor(uptime / 1000) : 0;
      message += `${t("status.line.managed_yes")}\n`;
      message += `${t("status.line.pid", { pid: processManager.getPID() ?? "-" })}\n`;
      message += `${t("status.line.uptime_sec", { seconds: uptimeStr })}\n`;
    } else {
      message += `${t("status.line.managed_no")}\n`;
    }

    // Add agent mode information
    const chatId = ctx.chat?.id ?? 0;
    const currentAgent = await fetchCurrentAgent(chatId);
    const agentDisplay = currentAgent
      ? getAgentDisplayName(currentAgent)
      : t("status.agent_not_set");
    message += `${t("status.line.mode", { mode: agentDisplay })}\n`;

    // Add model information
    const currentModel = fetchCurrentModel(chatId);
    const modelDisplay = `🤖 ${currentModel.providerID}/${currentModel.modelID}`;
    message += `${t("status.line.model", { model: modelDisplay })}\n`;

    const currentProject = getCurrentProject(chatId);
    if (currentProject) {
      const projectName = currentProject.name || currentProject.worktree;
      message += `\n${t("status.project_selected", { project: projectName })}\n`;
    } else {
      message += `\n${t("status.project_not_selected")}\n`;
      message += t("status.project_hint");
    }

    const currentSession = getCurrentSession(chatId);
    if (currentSession) {
      message += `\n${t("status.session_selected", { title: currentSession.title })}\n`;
    } else {
      message += `\n${t("status.session_not_selected")}\n`;
      message += t("status.session_hint");
    }

    if (ctx.chat) {
      if (!pinnedMessageManager.isInitialized(ctx.chat.id)) {
        pinnedMessageManager.initialize(ctx.api, ctx.chat.id);
      }
      // Fetch context limit if not yet loaded (e.g. fresh bot start)
      if (pinnedMessageManager.getContextLimit(ctx.chat.id) === 0) {
        await pinnedMessageManager.refreshContextLimit(ctx.chat.id);
      }
      keyboardManager.initialize(ctx.api, ctx.chat.id);
    }
    // Sync current context (tokens used + limit) into keyboard state
    const contextInfo = pinnedMessageManager.getContextInfo(ctx.chat?.id);
    if (contextInfo) {
      keyboardManager.updateContext(
        ctx.chat?.id ?? 0,
        contextInfo.tokensUsed,
        contextInfo.tokensLimit,
      );
    }
    const keyboard = keyboardManager.getKeyboard(ctx.chat?.id);
    if (ctx.chat) {
      await sendBotText({
        api: ctx.api,
        chatId: ctx.chat.id,
        text: message,
        options: { reply_markup: keyboard },
      });
    } else {
      await ctx.reply(message, { reply_markup: keyboard });
    }
  } catch (error) {
    logger.error("[Bot] Error checking server status:", error);
    const [redis, opencode] = await Promise.all([
      checkRedisHealth(),
      checkOpencodeHealth(),
    ]);
    if (!opencode.ok && !redis.ok) {
      await ctx.reply(t("status.both_down"));
    } else if (!opencode.ok) {
      await ctx.reply(t("status.opencode_down"));
    } else if (!redis.ok) {
      await ctx.reply(t("status.redis_down"));
    } else {
      await ctx.reply(t("status.server_unavailable"));
    }
  }
}
