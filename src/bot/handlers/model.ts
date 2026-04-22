import { Context, InlineKeyboard } from "grammy";
import { selectModel, fetchCurrentModel, getTelegramModelGroups } from "../../model/manager.js";
import { formatModelForDisplay } from "../../model/types.js";
import type { FavoriteModel, ModelInfo } from "../../model/types.js";
import { formatVariantForButton } from "../../variant/manager.js";
import { logger } from "../../utils/logger.js";
import { createMainKeyboard } from "../utils/keyboard.js";
import { getStoredAgent } from "../../agent/manager.js";
import { pinnedMessageManager } from "../../pinned/manager.js";
import { keyboardManager } from "../../keyboard/manager.js";
import {
  clearActiveInlineMenu,
  ensureActiveInlineMenu,
  replyWithInlineMenu,
} from "./inline-menu.js";
import { t } from "../../i18n/index.js";

function buildModelSelectionMenuText(modelCount: number): string {
  return `${t("model.menu.select")}\n\nShowing ${modelCount} models from GitHub Copilot & OpenCode Zen Free groups`;
}

// Index-based callback cache for model handler (separate from /models command cache)
const modelHandlerIndexCache = new Map<string, FavoriteModel>();

/**
 * Handle model selection callback
 * @param ctx grammY context
 * @returns true if handled, false otherwise
 */
export async function handleModelSelect(ctx: Context): Promise<boolean> {
  const callbackQuery = ctx.callbackQuery;

  if (!callbackQuery?.data) {
    return false;
  }

  // Support both old "model:" format and new "mi:" (model index) format
  const data = callbackQuery.data;
  let providerID: string;
  let modelID: string;

  if (data.startsWith("mi:")) {
    // New index-based format
    const index = data.slice(3);
    const model = modelHandlerIndexCache.get(index);
    if (!model) {
      logger.error(`[ModelHandler] Invalid model index: ${index}`);
      clearActiveInlineMenu(ctx.chat?.id ?? 0, "model_select_invalid_index");
      await ctx.answerCallbackQuery({ text: t("model.change_error_callback") }).catch(() => {});
      return true;
    }
    providerID = model.providerID;
    modelID = model.modelID;
  } else if (data.startsWith("model:")) {
    // Legacy format
    const parts = data.split(":");
    if (parts.length < 3) {
      logger.error(`[ModelHandler] Invalid callback data format: ${data}`);
      clearActiveInlineMenu(ctx.chat?.id ?? 0, "model_select_invalid_callback");
      await ctx.answerCallbackQuery({ text: t("model.change_error_callback") }).catch(() => {});
      return true;
    }
    providerID = parts[1];
    modelID = parts.slice(2).join(":");
  } else {
    return false;
  }

  const isActiveMenu = await ensureActiveInlineMenu(ctx, "model");
  if (!isActiveMenu) {
    return true;
  }

  logger.debug(`[ModelHandler] Received callback: ${data}`);

  const chatId = ctx.chat?.id;
  if (!chatId) return false;

  try {
    keyboardManager.initialize(ctx.api, chatId);

    const modelInfo: ModelInfo = {
      providerID,
      modelID,
      variant: "default",
    };

    selectModel(chatId, modelInfo);

    keyboardManager.updateModel(chatId, modelInfo);

    await pinnedMessageManager.refreshContextLimit(chatId);

    const currentAgent = getStoredAgent(chatId);
    const contextInfo =
      pinnedMessageManager.getContextInfo(chatId) ??
      (pinnedMessageManager.getContextLimit(chatId) > 0
        ? { tokensUsed: 0, tokensLimit: pinnedMessageManager.getContextLimit(chatId) }
        : null);

    if (contextInfo) {
      keyboardManager.updateContext(chatId, contextInfo.tokensUsed, contextInfo.tokensLimit);
    }

    const variantName = formatVariantForButton(modelInfo.variant || "default");
    const keyboard = createMainKeyboard(
      currentAgent,
      modelInfo,
      contextInfo ?? undefined,
      variantName,
    );
    const displayName = formatModelForDisplay(modelInfo.providerID, modelInfo.modelID);

    clearActiveInlineMenu(chatId, "model_selected");

    await ctx.answerCallbackQuery({ text: t("model.changed_callback", { name: displayName }) });
    await ctx.reply(t("model.changed_message", { name: displayName }), {
      reply_markup: keyboard,
    });

    await ctx.deleteMessage().catch(() => {});

    return true;
  } catch (err) {
    clearActiveInlineMenu(chatId, "model_select_error");
    logger.error("[ModelHandler] Error handling model select:", err);
    await ctx.answerCallbackQuery({ text: t("model.change_error_callback") }).catch(() => {});
    return false;
  }
}

/**
 * Build inline keyboard with Telegram group models
 * @param currentModel Current model for highlighting
 * @returns InlineKeyboard with model selection buttons
 */
export async function buildModelSelectionMenu(
  currentModel?: ModelInfo,
): Promise<InlineKeyboard> {
  const keyboard = new InlineKeyboard();
  const models = await getTelegramModelGroups();
  modelHandlerIndexCache.clear();

  if (models.length === 0) {
    logger.warn("[ModelHandler] No models found in Telegram groups");
    return keyboard;
  }

  const addButton = (model: FavoriteModel, label: string, idx: number): void => {
    const isActive =
      currentModel &&
      model.providerID === currentModel.providerID &&
      model.modelID === currentModel.modelID;

    const labelWithCheck = isActive ? `✅ ${label}` : label;
    const indexKey = String(idx);
    modelHandlerIndexCache.set(indexKey, model);
    // Use short index-based callback: "mi:<index>"
    keyboard.text(labelWithCheck.substring(0, 64), `mi:${indexKey}`).row();
  };

  let idx = 0;
  for (const model of models) {
    const groupLabel = model.providerID === "github-copilot" ? "🦊 GitHub Copilot" : "✨ OpenCode Zen";
    addButton(model, `${groupLabel} ${model.modelID}`, idx++);
  }

  return keyboard;
}

/**
 * Show model selection menu
 * @param ctx grammY context
 */
export async function showModelSelectionMenu(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;

  try {
    const currentModel = fetchCurrentModel(chatId ?? 0);
    const keyboard = await buildModelSelectionMenu(currentModel);

    if (keyboard.inline_keyboard.length === 0) {
      await ctx.reply(t("model.menu.empty"));
      return;
    }

    const text = buildModelSelectionMenuText(keyboard.inline_keyboard.length);

    await replyWithInlineMenu(ctx, {
      menuKind: "model",
      text,
      keyboard,
    });
  } catch (err) {
    logger.error("[ModelHandler] Error showing model menu:", err);
    await ctx.reply(t("model.menu.error"));
  }
}