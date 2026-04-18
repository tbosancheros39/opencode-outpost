import type { Api } from "grammy";
import { createMainKeyboard } from "../bot/utils/keyboard.js";
import type { ModelInfo } from "../model/types.js";
import { getStoredAgent } from "../agent/manager.js";
import { getStoredModel } from "../model/manager.js";
import { formatVariantForButton } from "../variant/manager.js";
import { logger } from "../utils/logger.js";
import type { ContextInfo, KeyboardState } from "./types.js";
import { t } from "../i18n/index.js";

class KeyboardManager {
  private states: Map<number, KeyboardState> = new Map();
  private apiByChat: Map<number, Api> = new Map();
  private lastUpdateTimeByChat: Map<number, number> = new Map();
  private readonly UPDATE_DEBOUNCE_MS = 2000;

  private getOrCreateState(chatId: number): KeyboardState {
    let state = this.states.get(chatId);
    if (!state) {
      const currentModel = getStoredModel(chatId);
      state = {
        currentAgent: getStoredAgent(chatId),
        currentModel: currentModel,
        contextInfo: null,
        variantName: formatVariantForButton(currentModel.variant || "default"),
      };
      this.states.set(chatId, state);
    }
    return state;
  }

  private getApiForChat(chatId: number): Api | null {
    return this.apiByChat.get(chatId) ?? null;
  }

  private getLastUpdateTime(chatId: number): number {
    return this.lastUpdateTimeByChat.get(chatId) ?? 0;
  }

  private setLastUpdateTime(chatId: number, time: number): void {
    this.lastUpdateTimeByChat.set(chatId, time);
  }

  public initialize(api: Api, chatId: number): void {
    this.apiByChat.set(chatId, api);

    if (!this.states.has(chatId)) {
      const currentModel = getStoredModel(chatId);
      const state: KeyboardState = {
        currentAgent: getStoredAgent(chatId),
        currentModel: currentModel,
        contextInfo: null,
        variantName: formatVariantForButton(currentModel.variant || "default"),
      };
      this.states.set(chatId, state);
      logger.debug(
        `[KeyboardManager] Initialized with agent="${state.currentAgent}", model="${state.currentModel.providerID}/${state.currentModel.modelID}", variant="${currentModel.variant || "default"}", chatId=${chatId}`,
      );
    } else {
      logger.debug("[KeyboardManager] Already initialized, updating chatId:", chatId);
    }
  }

  public updateAgent(chatId: number, agent: string): void {
    const state = this.getOrCreateState(chatId);
    if (!this.states.has(chatId)) {
      logger.warn("[KeyboardManager] Cannot update agent: not initialized");
      return;
    }
    state.currentAgent = agent;
    logger.debug(`[KeyboardManager] Agent updated: ${agent}`);
  }

  public updateModel(chatId: number, model: ModelInfo): void {
    const state = this.getOrCreateState(chatId);
    if (!this.states.has(chatId)) {
      logger.warn("[KeyboardManager] Cannot update model: not initialized");
      return;
    }
    state.currentModel = model;
    state.variantName = formatVariantForButton(model.variant || "default");
    logger.debug(
      `[KeyboardManager] Model updated: ${model.providerID}/${model.modelID}, variant: ${model.variant || "default"}`,
    );
  }

  public updateVariant(chatId: number, variantId: string): void {
    const state = this.getOrCreateState(chatId);
    if (!this.states.has(chatId)) {
      logger.warn("[KeyboardManager] Cannot update variant: not initialized");
      return;
    }
    state.variantName = formatVariantForButton(variantId);
    logger.debug(`[KeyboardManager] Variant updated: ${variantId}`);
  }

  public updateContext(chatId: number, tokensUsed: number, tokensLimit: number): void {
    const state = this.getOrCreateState(chatId);
    if (!this.states.has(chatId)) {
      logger.warn("[KeyboardManager] Cannot update context: not initialized");
      return;
    }
    state.contextInfo = { tokensUsed, tokensLimit };
    logger.debug(`[KeyboardManager] Context updated: ${tokensUsed}/${tokensLimit}`);
  }

  public clearContext(chatId: number): void {
    const state = this.getOrCreateState(chatId);
    if (!this.states.has(chatId)) {
      logger.warn("[KeyboardManager] Cannot clear context: not initialized");
      return;
    }
    state.contextInfo = null;
    logger.debug("[KeyboardManager] Context cleared");
  }

  public getContextInfo(chatId: number): ContextInfo | null {
    const state = this.states.get(chatId);
    return state?.contextInfo ?? null;
  }

  private buildKeyboard(chatId: number) {
    const state = this.states.get(chatId);
    if (!state) {
      logger.warn("[KeyboardManager] Cannot build keyboard: not initialized");
      return createMainKeyboard("build", { providerID: "", modelID: "" }, undefined);
    }
    return createMainKeyboard(
      state.currentAgent,
      state.currentModel,
      state.contextInfo ?? undefined,
      state.variantName,
    );
  }

  public async sendKeyboardUpdate(chatId: number): Promise<void> {
    const api = this.getApiForChat(chatId);
    if (!api) {
      logger.warn("[KeyboardManager] API not initialized");
      return;
    }

    if (!chatId) {
      logger.warn("[KeyboardManager] No chatId available");
      return;
    }

    const now = Date.now();
    if (now - this.getLastUpdateTime(chatId) < this.UPDATE_DEBOUNCE_MS) {
      logger.debug("[KeyboardManager] Update debounced");
      return;
    }

    this.setLastUpdateTime(chatId, now);

    try {
      const keyboard = this.buildKeyboard(chatId);

      await api.sendMessage(chatId, t("keyboard.updated"), {
        reply_markup: keyboard,
      });

      logger.debug("[KeyboardManager] Keyboard update sent");
    } catch (err) {
      logger.error("[KeyboardManager] Failed to send keyboard update:", err);
    }
  }

  public getKeyboard(chatId: number) {
    const state = this.states.get(chatId);
    if (!state) {
      logger.warn("[KeyboardManager] Cannot get keyboard: not initialized");
      return undefined;
    }
    return this.buildKeyboard(chatId);
  }

  public getState(chatId: number): KeyboardState | undefined {
    const state = this.states.get(chatId);
    if (!state) {
      return undefined;
    }
    return { ...state };
  }

  public isInitialized(chatId: number): boolean {
    return this.states.has(chatId);
  }
}

export const keyboardManager = new KeyboardManager();
