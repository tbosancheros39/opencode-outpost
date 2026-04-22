import { CommandContext, Context } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import { isSuperUser } from "../utils/user-tracker.js";
import { filterModelsByTelegramGroups } from "../../model/free-models.js";
import { replyWithInlineMenu } from "../handlers/inline-menu.js";
import { InlineKeyboard } from "grammy";

interface ModelInfo {
  providerID: string;
  modelID: string;
}

// Index-based callback cache to avoid exceeding Telegram's 64-byte callback_data limit
const modelIndexCache = new Map<string, ModelInfo>();

export function getModelByIndex(index: string): ModelInfo | undefined {
  return modelIndexCache.get(index);
}

function buildModelsKeyboard(models: ModelInfo[], currentSelection?: ModelInfo): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  modelIndexCache.clear();

  const addButton = (model: ModelInfo, idx: number): void => {
    const isActive =
      currentSelection &&
      model.providerID === currentSelection.providerID &&
      model.modelID === currentSelection.modelID;

    const label = isActive
      ? `✅ ${model.providerID}/${model.modelID}`
      : `${model.providerID}/${model.modelID}`;
    const indexKey = String(idx);
    modelIndexCache.set(indexKey, model);
    // Use short index-based callback: "mi:<index>" (max ~6 chars for index)
    keyboard.text(label.substring(0, 64), `mi:${indexKey}`).row();
  };

  const byProvider = new Map<string, ModelInfo[]>();
  for (const model of models) {
    if (!byProvider.has(model.providerID)) {
      byProvider.set(model.providerID, []);
    }
    byProvider.get(model.providerID)!.push(model);
  }

  let idx = 0;
  for (const providerModels of byProvider.values()) {
    for (const model of providerModels) {
      addButton(model, idx++);
    }
  }

  return keyboard;
}

export async function modelsCommand(ctx: CommandContext<Context>) {
  try {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;

    if (!userId || !chatId) {
      await ctx.reply(t("legacy.models.error"));
      return;
    }

    const { data: providersData, error } = await opencodeClient.config.providers();

    if (error || !providersData) {
      await ctx.reply(t("legacy.models.fetch_error"));
      return;
    }

    const providers = Array.isArray(providersData)
      ? providersData
      : providersData?.providers ?? [];

    if (!providers || providers.length === 0) {
      await ctx.reply(t("legacy.models.empty"));
      return;
    }

    const availableModels = filterModelsByTelegramGroups(providers);

    if (isSuperUser(userId)) {
      logger.info(
        `[ModelsCommand] Super user ${userId} viewing ${availableModels.length} Telegram-approved models`,
      );
    } else {
      logger.info(
        `[ModelsCommand] User ${userId} viewing ${availableModels.length} Telegram-approved models`,
      );
    }

    if (availableModels.length === 0) {
      await ctx.reply(t("legacy.models.empty"));
      return;
    }

    const keyboard = buildModelsKeyboard(availableModels);
    const hint = "Click a model to select it.";
    const message = `📋 Available models:\n\n${hint}`;

    await replyWithInlineMenu(ctx, {
      menuKind: "model",
      text: message,
      keyboard,
    });
  } catch (error) {
    logger.error("[ModelsCommand] Error listing models:", error);
    await ctx.reply(t("legacy.models.error"));
  }
}
