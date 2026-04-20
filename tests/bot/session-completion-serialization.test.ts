import { describe, expect, it } from "vitest";

describe("sessionCompletionTasks serialization", () => {
  it("prevents re-entrant completion for the same session while in-flight", async () => {
    const sessionCompletionTasks = new Map<string, Promise<void>>();
    const executionOrder: string[] = [];
    let resolveBlock: () => void;
    const blockPromise = new Promise<void>((resolve) => {
      resolveBlock = resolve;
    });

    async function handleCompletion(sessionId: string): Promise<void> {
      if (sessionCompletionTasks.has(sessionId)) {
        executionOrder.push(`${sessionId}-skipped`);
        return;
      }

      const task = (async () => {
        try {
          executionOrder.push(`${sessionId}-start`);
          await blockPromise;
          executionOrder.push(`${sessionId}-end`);
        } finally {
          sessionCompletionTasks.delete(sessionId);
        }
      })();

      sessionCompletionTasks.set(sessionId, task);
      await task;
    }

    const first = handleCompletion("session-a");

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(sessionCompletionTasks.has("session-a")).toBe(true);

    const second = handleCompletion("session-a");

    resolveBlock!();
    await first;
    await second;

    expect(executionOrder).toEqual(["session-a-start", "session-a-skipped", "session-a-end"]);
    expect(sessionCompletionTasks.has("session-a")).toBe(false);
  });

  it("cleans up Map entry after successful completion", async () => {
    const sessionCompletionTasks = new Map<string, Promise<void>>();

    async function handleCompletion(sessionId: string): Promise<void> {
      if (sessionCompletionTasks.has(sessionId)) {
        return;
      }

      const task = (async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 5));
        } finally {
          sessionCompletionTasks.delete(sessionId);
        }
      })();

      sessionCompletionTasks.set(sessionId, task);
      await task;
    }

    expect(sessionCompletionTasks.has("s1")).toBe(false);
    await handleCompletion("s1");
    expect(sessionCompletionTasks.has("s1")).toBe(false);
  });

  it("allows concurrent completions for different sessions", async () => {
    const sessionCompletionTasks = new Map<string, Promise<void>>();
    const completed: string[] = [];

    async function handleCompletion(sessionId: string): Promise<void> {
      if (sessionCompletionTasks.has(sessionId)) {
        return;
      }

      const task = (async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 10));
          completed.push(sessionId);
        } finally {
          sessionCompletionTasks.delete(sessionId);
        }
      })();

      sessionCompletionTasks.set(sessionId, task);
      await task;
    }

    await Promise.all([handleCompletion("session-a"), handleCompletion("session-b")]);

    expect(completed).toContain("session-a");
    expect(completed).toContain("session-b");
    expect(sessionCompletionTasks.size).toBe(0);
  });

  it("cleans up Map entry even when task throws after an await", async () => {
    const sessionCompletionTasks = new Map<string, Promise<void>>();

    async function handleCompletion(sessionId: string): Promise<void> {
      if (sessionCompletionTasks.has(sessionId)) {
        return;
      }

      const task = (async () => {
        try {
          await Promise.resolve();
          throw new Error("test error");
        } finally {
          sessionCompletionTasks.delete(sessionId);
        }
      })();

      sessionCompletionTasks.set(sessionId, task);

      try {
        await task;
      } catch {
        // Expected
      }
    }

    await handleCompletion("err-session");
    expect(sessionCompletionTasks.has("err-session")).toBe(false);
  });
});
