import { logger } from "../utils/logger.js";

interface RenameState {
  isWaiting: boolean;
  sessionId: string | null;
  sessionDirectory: string | null;
  currentTitle: string | null;
  messageId: number | null;
}

class RenameManager {
  private states: Map<number, RenameState> = new Map();

  private getState(chatId: number): RenameState {
    let state = this.states.get(chatId);
    if (!state) {
      state = {
        isWaiting: false,
        sessionId: null,
        sessionDirectory: null,
        currentTitle: null,
        messageId: null,
      };
      this.states.set(chatId, state);
    }
    return state;
  }

  startWaiting(chatId: number, sessionId: string, directory: string, currentTitle: string): void {
    logger.info(`[RenameManager] Starting rename flow for session: ${sessionId}`);
    const state = this.getState(chatId);
    state.isWaiting = true;
    state.sessionId = sessionId;
    state.sessionDirectory = directory;
    state.currentTitle = currentTitle;
    state.messageId = null;
  }

  setMessageId(chatId: number, messageId: number): void {
    this.getState(chatId).messageId = messageId;
  }

  getMessageId(chatId: number): number | null {
    return this.getState(chatId).messageId;
  }

  isActiveMessage(chatId: number, messageId: number | null): boolean {
    const state = this.getState(chatId);
    return (
      state.isWaiting && state.messageId !== null && state.messageId === messageId
    );
  }

  isWaitingForName(chatId: number): boolean {
    return this.getState(chatId).isWaiting;
  }

  getSessionInfo(chatId: number): { sessionId: string; directory: string; currentTitle: string } | null {
    const state = this.getState(chatId);
    if (!state.isWaiting || !state.sessionId) {
      return null;
    }
    return {
      sessionId: state.sessionId,
      directory: state.sessionDirectory!,
      currentTitle: state.currentTitle!,
    };
  }

  clear(chatId: number): void {
    logger.debug("[RenameManager] Clearing rename state");
    const state = this.getState(chatId);
    state.isWaiting = false;
    state.sessionId = null;
    state.sessionDirectory = null;
    state.currentTitle = null;
    state.messageId = null;
  }
}

export const renameManager = new RenameManager();
