import { logger } from "../utils/logger.js";

const BUSY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — auto-expire stuck busy states

class ForegroundSessionState {
  private activeSessionIds = new Set<string>();
  private busyTimers = new Map<string, ReturnType<typeof setTimeout>>();

  markBusy(sessionId: string): void {
    if (!sessionId) {
      return;
    }

    this.activeSessionIds.add(sessionId);

    // Clear any existing timer for this session
    const existing = this.busyTimers.get(sessionId);
    if (existing) {
      clearTimeout(existing);
    }

    // Set auto-expire timer — if markIdle is never called, this recovers automatically
    const timer = setTimeout(() => {
      this.activeSessionIds.delete(sessionId);
      this.busyTimers.delete(sessionId);
      logger.warn(
        `[ScheduledTaskForeground] Auto-expired busy state: session=${sessionId} (timeout ${BUSY_TIMEOUT_MS / 1000}s)`,
      );
    }, BUSY_TIMEOUT_MS);

    this.busyTimers.set(sessionId, timer);

    logger.debug(
      `[ScheduledTaskForeground] Marked session busy: session=${sessionId}, count=${this.activeSessionIds.size}`,
    );
  }

  markIdle(sessionId: string): void {
    if (!sessionId) {
      return;
    }

    this.activeSessionIds.delete(sessionId);

    // Clear auto-expire timer
    const timer = this.busyTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.busyTimers.delete(sessionId);
    }

    logger.debug(
      `[ScheduledTaskForeground] Marked session idle: session=${sessionId}, count=${this.activeSessionIds.size}`,
    );
  }

  isBusy(): boolean {
    return this.activeSessionIds.size > 0;
  }

  clearAll(reason: string): void {
    if (this.activeSessionIds.size === 0) {
      return;
    }

    // Clear all auto-expire timers
    for (const timer of this.busyTimers.values()) {
      clearTimeout(timer);
    }
    this.busyTimers.clear();

    logger.info(
      `[ScheduledTaskForeground] Cleared foreground busy state: reason=${reason}, count=${this.activeSessionIds.size}`,
    );
    this.activeSessionIds.clear();
  }

  __resetForTests(): void {
    for (const timer of this.busyTimers.values()) {
      clearTimeout(timer);
    }
    this.busyTimers.clear();
    this.activeSessionIds.clear();
  }
}

export const foregroundSessionState = new ForegroundSessionState();
