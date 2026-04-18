import { Context, InlineKeyboard } from "grammy";
import { selectAgent, getAvailableAgents, fetchCurrentAgent } from "../../agent/manager.js";
import { getAgentDisplayName, getAgentEmoji } from "../../agent/types.js";
import { getStoredModel } from "../../model/manager.js";
import { formatVariantForButton } from "../../variant/manager.js";
import { logger } from "../../utils/logger.js";
import { createMainKeyboard } from "../utils/keyboard.js";
import { pinnedMessageManager } from "../../pinned/manager.js";
import { keyboardManager } from "../../keyboard/manager.js";
import {
  clearActiveInlineMenu,
  ensureActiveInlineMenu,
  replyWithInlineMenu,
} from "./inline-menu.js";
import { t } from "../../i18n/index.js";

/**
 * Handle agent selection callback
 * @param ctx grammY context
 * @returns true if handled, false otherwise
 */
export async function handleAgentSelect(ctx: Context): Promise<boolean> {
  const callbackQuery = ctx.callbackQuery;

  if (!callbackQuery?.data || !callbackQuery.data.startsWith("agent:")) {
    return false;
  }

  const isActiveMenu = await ensureActiveInlineMenu(ctx, "agent");
  if (!isActiveMenu) {
    return true;
  }

  logger.debug(`[AgentHandler] Received callback: ${callbackQuery.data}`);

  const chatId = ctx.chat?.id;
  if (!chatId) return false;

  try {
    keyboardManager.initialize(ctx.api, chatId);

    if (pinnedMessageManager.getContextLimit(chatId) === 0) {
      await pinnedMessageManager.refreshContextLimit(chatId);
    }

    const agentName = callbackQuery.data.replace("agent:", "");

    selectAgent(chatId, agentName);

    keyboardManager.updateAgent(chatId, agentName);

    const currentModel = getStoredModel(chatId);
    const contextInfo =
      pinnedMessageManager.getContextInfo(chatId) ??
      (pinnedMessageManager.getContextLimit(chatId) > 0
        ? { tokensUsed: 0, tokensLimit: pinnedMessageManager.getContextLimit(chatId) }
        : null);

    keyboardManager.updateModel(chatId, currentModel);
    if (contextInfo) {
      keyboardManager.updateContext(chatId, contextInfo.tokensUsed, contextInfo.tokensLimit);
    }

    const state = keyboardManager.getState(chatId);
    const variantName =
      state?.variantName ?? formatVariantForButton(currentModel.variant || "default");
    const keyboard = createMainKeyboard(
      agentName,
      currentModel,
      contextInfo ?? undefined,
      variantName,
    );
    const displayName = getAgentDisplayName(agentName);

    clearActiveInlineMenu(chatId, "agent_selected");

    await ctx.answerCallbackQuery({ text: t("agent.changed_callback", { name: displayName }) });
    await ctx.reply(t("agent.changed_message", { name: displayName }), {
      reply_markup: keyboard,
    });

    await ctx.deleteMessage().catch(() => {});

    return true;
  } catch (err) {
    clearActiveInlineMenu(chatId, "agent_select_error");
    logger.error("[AgentHandler] Error handling agent select:", err);
    await ctx.answerCallbackQuery({ text: t("agent.change_error_callback") }).catch(() => {});
    return false;
  }
}

/**
 * Build inline keyboard with available agents
 * @param currentAgent Current agent name for highlighting
 * @param chatId Chat ID for manager calls
 * @returns InlineKeyboard with agent selection buttons
 */
export async function buildAgentSelectionMenu(
  currentAgent?: string,
  chatId?: number,
): Promise<InlineKeyboard> {
  const keyboard = new InlineKeyboard();
  const agents = await getAvailableAgents(chatId ?? 0);

  if (agents.length === 0) {
    logger.warn("[AgentHandler] No available agents found");
    return keyboard;
  }

  agents.forEach((agent) => {
    const emoji = getAgentEmoji(agent.name);
    const isActive = agent.name === currentAgent;
    const label = isActive
      ? `✅ ${emoji} ${agent.name.toUpperCase()}`
      : `${emoji} ${agent.name.charAt(0).toUpperCase() + agent.name.slice(1)}`;

    keyboard.text(label, `agent:${agent.name}`).row();
  });

  return keyboard;
}

/**
 * Show agent selection menu
 * @param ctx grammY context
 */
export async function showAgentSelectionMenu(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;

  try {
    const currentAgent = await fetchCurrentAgent(chatId ?? 0);
    const keyboard = await buildAgentSelectionMenu(currentAgent, chatId);

    if (keyboard.inline_keyboard.length === 0) {
      await ctx.reply(t("agent.menu.empty"));
      return;
    }

    const text = currentAgent
      ? t("agent.menu.current", { name: getAgentDisplayName(currentAgent) })
      : t("agent.menu.select");

    await replyWithInlineMenu(ctx, {
      menuKind: "agent",
      text,
      keyboard,
    });
  } catch (err) {
    logger.error("[AgentHandler] Error showing agent menu:", err);
    await ctx.reply(t("agent.menu.error"));
  }
}
