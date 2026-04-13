import type { Api } from "grammy";
import { logger } from "../utils/logger.js";
import { opencodeClient } from "../opencode/client.js";
import { getCurrentSession } from "../session/manager.js";
import {
  getCurrentProject,
  getPinnedMessageId,
  setPinnedMessageId,
  clearPinnedMessageId,
} from "../settings/manager.js";
import { getStoredModel } from "../model/manager.js";
import type { FileChange, PinnedMessageState, TokensInfo } from "./types.js";
import { t } from "../i18n/index.js";

class PinnedMessageManager {
  private states: Map<number, PinnedMessageState> = new Map();
  private apiByChat: Map<number, Api> = new Map();
  private contextLimitByChat: Map<number, number | null> = new Map();
  private onKeyboardUpdateCallback?: (tokensUsed: number, tokensLimit: number) => void;

  private getOrCreateState(chatId: number): PinnedMessageState {
    let state = this.states.get(chatId);
    if (!state) {
      state = {
        messageId: null,
        chatId: null,
        sessionId: null,
        sessionTitle: t("pinned.default_session_title"),
        projectName: "",
        tokensUsed: 0,
        tokensLimit: 0,
        lastUpdated: 0,
        changedFiles: [],
        cost: 0,
      };
      this.states.set(chatId, state);
    }
    return state;
  }

  private getApiForChat(chatId: number): Api | null {
    return this.apiByChat.get(chatId) ?? null;
  }

  private getContextLimitForChat(chatId: number): number | null {
    return this.contextLimitByChat.get(chatId) ?? null;
  }

  private setContextLimitForChat(chatId: number, limit: number | null): void {
    this.contextLimitByChat.set(chatId, limit);
  }

  initialize(api: Api, chatId: number): void {
    this.apiByChat.set(chatId, api);

    const state = this.getOrCreateState(chatId);

    const savedMessageId = getPinnedMessageId(chatId);
    if (savedMessageId) {
      state.messageId = savedMessageId;
      state.chatId = chatId;
    }
  }

  async onSessionChange(chatId: number, sessionId: string, sessionTitle: string): Promise<void> {
    logger.info(`[PinnedManager] Session changed: ${sessionId}, title: ${sessionTitle}`);

    const state = this.getOrCreateState(chatId);

    state.tokensUsed = 0;
    state.cost = 0;

    state.sessionId = sessionId;
    state.sessionTitle = sessionTitle || t("pinned.default_session_title");

    const project = getCurrentProject(chatId);
    state.projectName =
      project?.name || this.extractProjectName(project?.worktree) || t("pinned.unknown");

    await this.fetchContextLimit(chatId);

    if (this.onKeyboardUpdateCallback && state.tokensLimit > 0) {
      this.onKeyboardUpdateCallback(state.tokensUsed, state.tokensLimit);
    }

    state.changedFiles = [];

    await this.unpinOldMessage(chatId);
    await this.createPinnedMessage(chatId);

    await this.loadDiffsFromApi(chatId, sessionId);
  }

  async onSessionTitleUpdate(chatId: number, newTitle: string): Promise<void> {
    const state = this.getOrCreateState(chatId);
    if (state.sessionTitle !== newTitle && newTitle) {
      logger.debug(`[PinnedManager] Session title updated: ${newTitle}`);
      state.sessionTitle = newTitle;
      await this.updatePinnedMessage(chatId);
    }
  }

  async loadContextFromHistory(
    chatId: number,
    sessionId: string,
    directory: string,
  ): Promise<void> {
    try {
      logger.debug(`[PinnedManager] Loading context from history for session: ${sessionId}`);

      const { data: messagesData, error } = await opencodeClient.session.messages({
        sessionID: sessionId,
        directory,
      });

      if (error || !messagesData) {
        logger.warn("[PinnedManager] Failed to load session history:", error);
        return;
      }

      let maxContextSize = 0;
      let totalCost = 0;
      logger.debug(`[PinnedManager] Processing ${messagesData.length} messages from history`);

      messagesData.forEach(({ info }) => {
        if (info.role === "assistant") {
          const assistantInfo = info as {
            summary?: boolean;
            tokens?: {
              input: number;
              cache?: { read: number };
            };
            cost?: number;
          };

          if (assistantInfo.summary) {
            logger.debug(`[PinnedManager] Skipping summary message`);
            return;
          }

          const input = assistantInfo.tokens?.input || 0;
          const cacheRead = assistantInfo.tokens?.cache?.read || 0;
          const contextSize = input + cacheRead;
          const cost = assistantInfo.cost || 0;

          logger.debug(
            `[PinnedManager] Assistant message: input=${input}, cache.read=${cacheRead}, total=${contextSize}, cost=$${cost.toFixed(2)}`,
          );

          if (contextSize > maxContextSize) {
            maxContextSize = contextSize;
          }

          totalCost += cost;
        }
      });

      const state = this.getOrCreateState(chatId);
      state.tokensUsed = maxContextSize;
      state.cost = totalCost;
      state.sessionId = sessionId;

      logger.info(
        `[PinnedManager] Loaded context from history: ${state.tokensUsed} tokens, cost: $${state.cost.toFixed(2)}`,
      );

      await this.updatePinnedMessage(chatId);
    } catch (err) {
      logger.error("[PinnedManager] Error loading context from history:", err);
    }
  }

  async onSessionCompacted(chatId: number, sessionId: string, directory: string): Promise<void> {
    logger.info(`[PinnedManager] Session compacted, reloading context: ${sessionId}`);

    await this.loadContextFromHistory(chatId, sessionId, directory);
  }

  async onMessageComplete(chatId: number, tokens: TokensInfo): Promise<void> {
    const state = this.getOrCreateState(chatId);

    if (this.getContextLimitForChat(chatId) === 0) {
      await this.fetchContextLimit(chatId);
    }

    state.tokensUsed = tokens.input + tokens.cacheRead;

    logger.debug(`[PinnedManager] Tokens updated: ${state.tokensUsed}/${state.tokensLimit}`);

    await this.refreshSessionTitle(chatId);

    await this.updatePinnedMessage(chatId);
  }

  async onCostUpdate(chatId: number, cost: number): Promise<void> {
    const state = this.getOrCreateState(chatId);
    const currentCost = state.cost || 0;
    state.cost = currentCost + cost;
    logger.debug(
      `[PinnedManager] Cost added: $${cost.toFixed(2)}, total session: $${(state.cost || 0).toFixed(2)}`,
    );
    await this.updatePinnedMessage(chatId);
  }

  setOnKeyboardUpdate(callback: (tokensUsed: number, tokensLimit: number) => void): void {
    this.onKeyboardUpdateCallback = callback;
    logger.debug("[PinnedManager] Keyboard update callback registered");
  }

  getContextInfo(chatId: number): { tokensUsed: number; tokensLimit: number } | null {
    const state = this.getOrCreateState(chatId);
    const limit =
      state.tokensLimit > 0 ? state.tokensLimit : this.getContextLimitForChat(chatId) || 0;
    if (limit === 0) {
      return null;
    }
    return {
      tokensUsed: state.tokensUsed,
      tokensLimit: limit,
    };
  }

  getContextLimit(chatId: number): number {
    const state = this.getOrCreateState(chatId);
    return this.getContextLimitForChat(chatId) ?? state.tokensLimit ?? 0;
  }

  async refreshContextLimit(chatId: number): Promise<void> {
    await this.fetchContextLimit(chatId);
  }

  async onSessionDiff(chatId: number, diffs: FileChange[]): Promise<void> {
    const state = this.getOrCreateState(chatId);
    if (diffs.length === 0 && state.changedFiles.length > 0) {
      logger.debug("[PinnedManager] Ignoring empty session.diff, keeping tool-collected data");
      return;
    }
    state.changedFiles = diffs;
    logger.debug(`[PinnedManager] Session diff updated: ${diffs.length} files`);
    await this.updatePinnedMessage(chatId);
  }

  addFileChange(chatId: number, change: FileChange): void {
    const state = this.getOrCreateState(chatId);
    const existing = state.changedFiles.find((f) => f.file === change.file);
    if (existing) {
      existing.additions += change.additions;
      existing.deletions += change.deletions;
    } else {
      state.changedFiles.push(change);
    }
    logger.debug(
      `[PinnedManager] File change added: ${change.file} (+${change.additions} -${change.deletions}), total: ${state.changedFiles.length}`,
    );

    this.scheduleDebouncedUpdate(chatId);
  }

  private updateDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleDebouncedUpdate(chatId: number): void {
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }
    this.updateDebounceTimer = setTimeout(() => {
      this.updateDebounceTimer = null;
      this.updatePinnedMessage(chatId);
    }, 500);
  }

  private async loadDiffsFromApi(chatId: number, sessionId: string): Promise<void> {
    try {
      const project = getCurrentProject(chatId);
      if (!project) {
        logger.debug("[PinnedManager] loadDiffsFromApi: no project");
        return;
      }

      logger.debug(`[PinnedManager] loadDiffsFromApi: trying session.diff() for ${sessionId}`);

      const { data, error } = await opencodeClient.session.diff({
        sessionID: sessionId,
        directory: project.worktree,
      });

      logger.debug(
        `[PinnedManager] session.diff() result: error=${!!error}, data.length=${data?.length ?? 0}`,
      );

      const state = this.getOrCreateState(chatId);

      if (!error && data && data.length > 0) {
        state.changedFiles = data.map((d) => ({
          file: d.file,
          additions: d.additions,
          deletions: d.deletions,
        }));
        logger.info(
          `[PinnedManager] Loaded ${state.changedFiles.length} file diffs from session.diff()`,
        );
        await this.updatePinnedMessage(chatId);
        return;
      }

      logger.debug("[PinnedManager] session.diff() empty, trying loadDiffsFromMessages()");
      await this.loadDiffsFromMessages(chatId, sessionId, project.worktree);
    } catch (err) {
      logger.debug("[PinnedManager] Could not load diffs from API:", err);
    }
  }

  private async loadDiffsFromMessages(
    chatId: number,
    sessionId: string,
    directory: string,
  ): Promise<void> {
    try {
      logger.debug(`[PinnedManager] loadDiffsFromMessages: fetching messages for ${sessionId}`);

      const { data: messagesData, error } = await opencodeClient.session.messages({
        sessionID: sessionId,
        directory,
      });

      if (error || !messagesData) {
        logger.debug(`[PinnedManager] loadDiffsFromMessages: error or no data`);
        return;
      }

      logger.debug(`[PinnedManager] loadDiffsFromMessages: ${messagesData.length} messages`);

      const filesMap = new Map<string, FileChange>();

      let toolCount = 0;
      let fileToolCount = 0;

      for (const { parts } of messagesData) {
        for (const part of parts) {
          if (part.type !== "tool") continue;
          toolCount++;

          const toolPart = part as {
            tool: string;
            state: {
              status: string;
              input?: { [key: string]: unknown };
              metadata?: { [key: string]: unknown };
            };
          };

          if (toolPart.state.status !== "completed") continue;

          if (
            toolPart.tool === "edit" ||
            toolPart.tool === "write" ||
            toolPart.tool === "apply_patch"
          ) {
            fileToolCount++;
          }

          if (
            (toolPart.tool === "edit" || toolPart.tool === "apply_patch") &&
            toolPart.state.metadata &&
            "filediff" in toolPart.state.metadata
          ) {
            const filediff = toolPart.state.metadata.filediff as {
              file?: string;
              additions?: number;
              deletions?: number;
            };
            if (filediff.file) {
              const existing = filesMap.get(filediff.file);
              if (existing) {
                existing.additions += filediff.additions || 0;
                existing.deletions += filediff.deletions || 0;
              } else {
                filesMap.set(filediff.file, {
                  file: filediff.file,
                  additions: filediff.additions || 0,
                  deletions: filediff.deletions || 0,
                });
              }
            }
          } else if (
            toolPart.tool === "write" &&
            toolPart.state.input &&
            "filePath" in toolPart.state.input &&
            "content" in toolPart.state.input
          ) {
            const filePath = toolPart.state.input.filePath as string;
            const content = toolPart.state.input.content as string;
            const lines = content.split("\n").length;
            const existing = filesMap.get(filePath);
            if (existing) {
              existing.additions += lines;
            } else {
              filesMap.set(filePath, {
                file: filePath,
                additions: lines,
                deletions: 0,
              });
            }
          }
        }
      }

      logger.debug(
        `[PinnedManager] loadDiffsFromMessages: found ${toolCount} tool parts, ${fileToolCount} file tools`,
      );

      const state = this.getOrCreateState(chatId);

      if (filesMap.size > 0) {
        state.changedFiles = Array.from(filesMap.values());
        logger.info(`[PinnedManager] Loaded ${state.changedFiles.length} file diffs from messages`);
        await this.updatePinnedMessage(chatId);
      } else {
        logger.debug("[PinnedManager] loadDiffsFromMessages: no file changes found");
      }
    } catch (err) {
      logger.debug("[PinnedManager] Could not load diffs from messages:", err);
    }
  }

  private async refreshSessionTitle(chatId: number): Promise<void> {
    const session = getCurrentSession(chatId);
    const project = getCurrentProject(chatId);

    if (!session || !project) {
      return;
    }

    const state = this.getOrCreateState(chatId);

    try {
      const { data: sessionData } = await opencodeClient.session.get({
        sessionID: session.id,
        directory: project.worktree,
      });

      if (sessionData && sessionData.title !== state.sessionTitle) {
        state.sessionTitle = sessionData.title;
        logger.debug(`[PinnedManager] Session title refreshed: ${sessionData.title}`);
      }
    } catch (err) {
      logger.debug("[PinnedManager] Could not refresh session title:", err);
    }
  }

  private extractProjectName(worktree: string | undefined): string {
    if (!worktree) return "";
    const parts = worktree.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || "";
  }

  private makeRelativePath(chatId: number, filePath: string): string {
    const normalized = filePath.replace(/\\/g, "/");
    const project = getCurrentProject(chatId);

    if (project?.worktree) {
      const worktree = project.worktree.replace(/\\/g, "/");
      if (normalized.startsWith(worktree)) {
        let relative = normalized.slice(worktree.length);
        if (relative.startsWith("/")) {
          relative = relative.slice(1);
        }
        return relative || normalized;
      }
    }

    const segments = normalized.split("/");
    if (segments.length <= 3) return normalized;
    return ".../" + segments.slice(-3).join("/");
  }

  private async fetchContextLimit(chatId: number): Promise<void> {
    try {
      const model = getStoredModel(chatId);
      if (!model.providerID || !model.modelID) {
        logger.warn("[PinnedManager] No model configured, using default limit");
        const limit = 200000;
        this.setContextLimitForChat(chatId, limit);
        const state = this.getOrCreateState(chatId);
        state.tokensLimit = limit;
        return;
      }

      const { data: providersData, error } = await opencodeClient.config.providers();

      if (error || !providersData) {
        logger.warn("[PinnedManager] Failed to fetch providers, using default limit");
        const limit = 200000;
        this.setContextLimitForChat(chatId, limit);
        const state = this.getOrCreateState(chatId);
        state.tokensLimit = limit;
        return;
      }

      for (const provider of providersData.providers) {
        if (provider.id === model.providerID) {
          const modelInfo = provider.models[model.modelID];
          if (modelInfo?.limit?.context) {
            const limit = modelInfo.limit.context;
            this.setContextLimitForChat(chatId, limit);
            const state = this.getOrCreateState(chatId);
            state.tokensLimit = limit;
            logger.debug(`[PinnedManager] Context limit: ${limit}`);
            return;
          }
        }
      }

      logger.warn("[PinnedManager] Model not found in providers, using default limit");
      const limit = 200000;
      this.setContextLimitForChat(chatId, limit);
      const state = this.getOrCreateState(chatId);
      state.tokensLimit = limit;
    } catch (err) {
      logger.error("[PinnedManager] Error fetching context limit:", err);
      const limit = 200000;
      this.setContextLimitForChat(chatId, limit);
      const state = this.getOrCreateState(chatId);
      state.tokensLimit = limit;
    }
  }

  private formatMessage(chatId: number): string {
    const state = this.getOrCreateState(chatId);
    const percentage =
      state.tokensLimit > 0 ? Math.round((state.tokensUsed / state.tokensLimit) * 100) : 0;

    const tokensFormatted = this.formatTokenCount(state.tokensUsed);
    const limitFormatted = this.formatTokenCount(state.tokensLimit);

    const currentModel = getStoredModel(chatId);
    const modelName =
      currentModel.providerID && currentModel.modelID
        ? `${currentModel.providerID}/${currentModel.modelID}`
        : t("pinned.unknown");

    const lines = [
      `${state.sessionTitle}`,
      t("pinned.line.project", { project: state.projectName }),
      t("pinned.line.model", { model: modelName }),
      t("pinned.line.context", {
        used: tokensFormatted,
        limit: limitFormatted,
        percent: percentage,
      }),
    ];

    if (state.cost !== undefined && state.cost !== null) {
      lines.push(t("pinned.line.cost", { cost: `$${state.cost.toFixed(2)}` }));
    }

    if (state.changedFiles.length > 0) {
      const maxFiles = 10;
      const total = state.changedFiles.length;
      const filesToShow = state.changedFiles.slice(0, maxFiles);

      lines.push("");
      lines.push(t("pinned.files.title", { count: total }));

      for (const f of filesToShow) {
        const relativePath = this.makeRelativePath(chatId, f.file);
        const parts = [];
        if (f.additions > 0) parts.push(`+${f.additions}`);
        if (f.deletions > 0) parts.push(`-${f.deletions}`);
        const diffStr = parts.length > 0 ? ` (${parts.join(" ")})` : "";
        lines.push(t("pinned.files.item", { path: relativePath, diff: diffStr }));
      }

      if (total > maxFiles) {
        lines.push(t("pinned.files.more", { count: total - maxFiles }));
      }
    }

    return lines.join("\n");
  }

  private formatTokenCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${Math.round(count / 1000)}K`;
    }
    return count.toString();
  }

  private async createPinnedMessage(chatId: number): Promise<void> {
    const api = this.getApiForChat(chatId);
    const state = this.getOrCreateState(chatId);

    if (!api || !chatId) {
      logger.warn("[PinnedManager] API or chatId not initialized");
      return;
    }

    try {
      const text = this.formatMessage(chatId);

      const sentMessage = await api.sendMessage(chatId, text);

      state.messageId = sentMessage.message_id;
      state.chatId = chatId;
      state.lastUpdated = Date.now();

      setPinnedMessageId(chatId, sentMessage.message_id);

      await api.pinChatMessage(chatId, sentMessage.message_id, {
        disable_notification: true,
      });

      logger.info(`[PinnedManager] Created and pinned message: ${sentMessage.message_id}`);
    } catch (err) {
      logger.error("[PinnedManager] Error creating pinned message:", err);
    }
  }

  private async updatePinnedMessage(chatId: number): Promise<void> {
    const api = this.getApiForChat(chatId);
    const state = this.getOrCreateState(chatId);

    if (!api || !chatId || !state.messageId) {
      return;
    }

    try {
      const text = this.formatMessage(chatId);

      await api.editMessageText(chatId, state.messageId, text);
      state.lastUpdated = Date.now();

      logger.debug(`[PinnedManager] Updated pinned message: ${state.messageId}`);

      if (this.onKeyboardUpdateCallback && state.tokensLimit > 0) {
        setImmediate(() => {
          this.onKeyboardUpdateCallback!(state.tokensUsed, state.tokensLimit);
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("message is not modified")) {
        return;
      }

      if (err instanceof Error && err.message.includes("message to edit not found")) {
        logger.warn("[PinnedManager] Pinned message was deleted, recreating...");
        state.messageId = null;
        clearPinnedMessageId(chatId);
        await this.createPinnedMessage(chatId);
        return;
      }

      logger.error("[PinnedManager] Error updating pinned message:", err);
    }
  }

  private async unpinOldMessage(chatId: number): Promise<void> {
    const api = this.getApiForChat(chatId);

    if (!api || !chatId) {
      return;
    }

    try {
      await api.unpinAllChatMessages(chatId).catch(() => {});

      const state = this.getOrCreateState(chatId);
      state.messageId = null;
      clearPinnedMessageId(chatId);

      logger.debug("[PinnedManager] Unpinned old messages");
    } catch (err) {
      logger.error("[PinnedManager] Error unpinning messages:", err);
    }
  }

  getState(chatId: number): PinnedMessageState {
    return { ...this.getOrCreateState(chatId) };
  }

  isInitialized(chatId: number): boolean {
    return this.getApiForChat(chatId) !== null;
  }

  async clear(chatId: number): Promise<void> {
    const api = this.getApiForChat(chatId);
    const state = this.getOrCreateState(chatId);

    if (!api || !chatId) {
      state.messageId = null;
      state.sessionId = null;
      state.tokensUsed = 0;
      state.tokensLimit = 0;
      state.changedFiles = [];
      clearPinnedMessageId(chatId);
      return;
    }

    try {
      await api.unpinAllChatMessages(chatId).catch(() => {});

      state.messageId = null;
      state.sessionId = null;
      state.sessionTitle = t("pinned.default_session_title");
      state.projectName = "";
      state.tokensUsed = 0;
      state.tokensLimit = 0;
      state.changedFiles = [];
      clearPinnedMessageId(chatId);

      logger.info("[PinnedManager] Cleared pinned message state");
    } catch (err) {
      logger.error("[PinnedManager] Error clearing pinned message:", err);
    }
  }
}

export const pinnedMessageManager = new PinnedMessageManager();
