import { PermissionRequest, PermissionState } from "./types.js";
import { logger } from "../utils/logger.js";

class PermissionManager {
  private states: Map<number, PermissionState> = new Map();

  private getState(chatId: number): PermissionState {
    let state = this.states.get(chatId);
    if (!state) {
      state = {
        requestsByMessageId: new Map(),
      };
      this.states.set(chatId, state);
    }
    return state;
  }

  startPermission(chatId: number, request: PermissionRequest, messageId: number): void {
    const state = this.getState(chatId);
    logger.debug(
      `[PermissionManager] startPermission: id=${request.id}, permission=${request.permission}, messageId=${messageId}`,
    );

    if (state.requestsByMessageId.has(messageId)) {
      logger.warn(`[PermissionManager] Message ID already tracked, replacing: ${messageId}`);
    }

    state.requestsByMessageId.set(messageId, request);

    logger.info(
      `[PermissionManager] New permission request: type=${request.permission}, patterns=${request.patterns.join(", ")}, pending=${state.requestsByMessageId.size}`,
    );
  }

  getRequest(chatId: number, messageId: number | null): PermissionRequest | null {
    if (messageId === null) {
      return null;
    }

    return this.getState(chatId).requestsByMessageId.get(messageId) ?? null;
  }

  getRequestID(chatId: number, messageId: number | null): string | null {
    return this.getRequest(chatId, messageId)?.id ?? null;
  }

  getPermissionType(chatId: number, messageId: number | null): string | null {
    return this.getRequest(chatId, messageId)?.permission ?? null;
  }

  getPatterns(chatId: number, messageId: number | null): string[] {
    return this.getRequest(chatId, messageId)?.patterns ?? [];
  }

  isActiveMessage(chatId: number, messageId: number | null): boolean {
    return messageId !== null && this.getState(chatId).requestsByMessageId.has(messageId);
  }

  getMessageId(chatId: number): number | null {
    const messageIds = this.getMessageIds(chatId);
    if (messageIds.length === 0) {
      return null;
    }

    return messageIds[messageIds.length - 1];
  }

  getMessageIds(chatId: number): number[] {
    return Array.from(this.getState(chatId).requestsByMessageId.keys());
  }

  removeByMessageId(chatId: number, messageId: number | null): PermissionRequest | null {
    const request = this.getRequest(chatId, messageId);
    if (!request || messageId === null) {
      return null;
    }

    this.getState(chatId).requestsByMessageId.delete(messageId);

    logger.debug(
      `[PermissionManager] Removed permission request: id=${request.id}, messageId=${messageId}, pending=${this.getState(chatId).requestsByMessageId.size}`,
    );

    return request;
  }

  getPendingCount(chatId: number): number {
    return this.getState(chatId).requestsByMessageId.size;
  }

  isActive(chatId: number): boolean {
    return this.getState(chatId).requestsByMessageId.size > 0;
  }

  clear(chatId: number): void {
    const state = this.getState(chatId);
    logger.debug(
      `[PermissionManager] Clearing permission state: pending=${state.requestsByMessageId.size}`,
    );

    state.requestsByMessageId = new Map();
  }
}

export const permissionManager = new PermissionManager();
