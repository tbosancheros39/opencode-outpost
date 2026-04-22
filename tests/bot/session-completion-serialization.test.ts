import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { foregroundSessionState } from "../../src/scheduled-task/foreground-state.js";

describe("sessionCompletionTasks serialization", () => {
  it("serializes completions via await (not skip) for same session", async () => {
    const sessionCompletionTasks = new Map<string, Promise<void>>();
    const executionOrder: string[] = [];
    let resolveBlock: () => void;
    const blockPromise = new Promise<void>((resolve) => {
      resolveBlock = resolve;
    });

    async function handleCompletion(sessionId: string): Promise<void> {
      // Wait for any previous completion task for this session (new pattern)
      const previousTask = sessionCompletionTasks.get(sessionId);
      if (previousTask) {
        executionOrder.push(`${sessionId}-waiting`);
        await previousTask;
      }

      const task = (async () => {
        try {
          executionOrder.push(`${sessionId}-start`);
          await blockPromise;
          executionOrder.push(`${sessionId}-end`);
        } finally {
          // Cleanup must happen AFTER await, not in a skip branch
        }
      })();

      sessionCompletionTasks.set(sessionId, task);
      await task;
      sessionCompletionTasks.delete(sessionId);
    }

    const first = handleCompletion("session-a");

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(sessionCompletionTasks.has("session-a")).toBe(true);

    const second = handleCompletion("session-a");

    resolveBlock!();
    await first;
    await second;

    // Second completion WAITS for first (not skipped)
    expect(executionOrder).toEqual([
      "session-a-start",
      "session-a-waiting",
      "session-a-end",
      "session-a-start",
      "session-a-end",
    ]);
    expect(sessionCompletionTasks.has("session-a")).toBe(false);
  });

  it("cleans up Map entry after successful completion", async () => {
    const sessionCompletionTasks = new Map<string, Promise<void>>();

    async function handleCompletion(sessionId: string): Promise<void> {
      const previousTask = sessionCompletionTasks.get(sessionId);
      if (previousTask) {
        await previousTask;
      }

      const task = (async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      })();

      sessionCompletionTasks.set(sessionId, task);
      await task;
      sessionCompletionTasks.delete(sessionId);
    }

    expect(sessionCompletionTasks.has("s1")).toBe(false);
    await handleCompletion("s1");
    expect(sessionCompletionTasks.has("s1")).toBe(false);
  });

  it("allows concurrent completions for different sessions", async () => {
    const sessionCompletionTasks = new Map<string, Promise<void>>();
    const completed: string[] = [];

    async function handleCompletion(sessionId: string): Promise<void> {
      const previousTask = sessionCompletionTasks.get(sessionId);
      if (previousTask) {
        await previousTask;
      }

      const task = (async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        completed.push(sessionId);
      })();

      sessionCompletionTasks.set(sessionId, task);
      await task;
      sessionCompletionTasks.delete(sessionId);
    }

    await Promise.all([handleCompletion("session-a"), handleCompletion("session-b")]);

    expect(completed).toContain("session-a");
    expect(completed).toContain("session-b");
    expect(sessionCompletionTasks.size).toBe(0);
  });

  it("cleans up Map entry even when task throws", async () => {
    const sessionCompletionTasks = new Map<string, Promise<void>>();

    async function handleCompletion(sessionId: string): Promise<void> {
      const previousTask = sessionCompletionTasks.get(sessionId);
      if (previousTask) {
        await previousTask;
      }

      const task = (async () => {
        await Promise.resolve();
        throw new Error("test error");
      })();

      sessionCompletionTasks.set(sessionId, task);

      try {
        await task;
      } catch {
        // Expected
      }
      sessionCompletionTasks.delete(sessionId);
    }

    await handleCompletion("err-session");
    expect(sessionCompletionTasks.has("err-session")).toBe(false);
  });

  it("calls markIdle for both completions when two prompts fire rapidly", async () => {
    const markIdleCalls: string[] = [];
    const sessionCompletionTasks = new Map<string, Promise<void>>();

    // Simulate the markIdle function
    function markIdle(sessionId: string): void {
      markIdleCalls.push(sessionId);
    }

    async function handleCompletion(sessionId: string): Promise<void> {
      const previousTask = sessionCompletionTasks.get(sessionId);
      if (previousTask) {
        await previousTask;
      }

      const task = (async () => {
        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 5));
      })();

      sessionCompletionTasks.set(sessionId, task);
      await task;
      sessionCompletionTasks.delete(sessionId);

      // markIdle must be called for EVERY completion, not just the first
      markIdle(sessionId);
    }

    // Fire two rapid completions for same session
    await Promise.all([handleCompletion("sess-1"), handleCompletion("sess-1")]);

    // Both completions must call markIdle
    expect(markIdleCalls).toEqual(["sess-1", "sess-1"]);
    expect(sessionCompletionTasks.has("sess-1")).toBe(false);
  });
});

describe("foregroundSessionState busy timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    foregroundSessionState.__resetForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    foregroundSessionState.__resetForTests();
  });

  it("marks session busy and idle correctly", () => {
    foregroundSessionState.markBusy("sess-1");
    expect(foregroundSessionState.isBusy()).toBe(true);

    foregroundSessionState.markIdle("sess-1");
    expect(foregroundSessionState.isBusy()).toBe(false);
  });

  it("auto-expires busy state after timeout", () => {
    foregroundSessionState.markBusy("sess-1");
    expect(foregroundSessionState.isBusy()).toBe(true);

    // Advance 10 minutes (BUSY_TIMEOUT_MS)
    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(foregroundSessionState.isBusy()).toBe(false);
  });

  it("does not auto-expire if markIdle is called before timeout", () => {
    foregroundSessionState.markBusy("sess-1");

    // Advance 5 minutes (halfway)
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(foregroundSessionState.isBusy()).toBe(true);

    // Mark idle before timeout
    foregroundSessionState.markIdle("sess-1");
    expect(foregroundSessionState.isBusy()).toBe(false);

    // Advance past timeout — should not affect anything
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(foregroundSessionState.isBusy()).toBe(false);
  });

  it("clearAll clears all timers and sessions", () => {
    foregroundSessionState.markBusy("sess-1");
    foregroundSessionState.markBusy("sess-2");
    expect(foregroundSessionState.isBusy()).toBe(true);

    foregroundSessionState.clearAll("test");

    expect(foregroundSessionState.isBusy()).toBe(false);

    // Timers should not fire after clearAll
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(foregroundSessionState.isBusy()).toBe(false);
  });

  it("resets timer when markBusy is called again for same session", () => {
    foregroundSessionState.markBusy("sess-1");

    // Advance 9 minutes
    vi.advanceTimersByTime(9 * 60 * 1000);
    expect(foregroundSessionState.isBusy()).toBe(true);

    // Mark busy again (resets timer)
    foregroundSessionState.markBusy("sess-1");

    // Advance another 9 minutes (total 18 min, but timer was reset at 9)
    vi.advanceTimersByTime(9 * 60 * 1000);
    expect(foregroundSessionState.isBusy()).toBe(true);

    // Advance 1 more minute (10 min since reset)
    vi.advanceTimersByTime(1 * 60 * 1000);
    expect(foregroundSessionState.isBusy()).toBe(false);
  });

  it("handles multiple sessions independently", () => {
    foregroundSessionState.markBusy("sess-1");
    foregroundSessionState.markBusy("sess-2");

    // Mark sess-1 idle
    foregroundSessionState.markIdle("sess-1");
    expect(foregroundSessionState.isBusy()).toBe(true); // sess-2 still busy

    // Auto-expire sess-2
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(foregroundSessionState.isBusy()).toBe(false);
  });

  it("ignores empty sessionId", () => {
    foregroundSessionState.markBusy("");
    expect(foregroundSessionState.isBusy()).toBe(false);

    foregroundSessionState.markIdle("");
    // Should not throw
  });
});
