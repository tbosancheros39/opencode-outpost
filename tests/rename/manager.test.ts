import { describe, expect, it, beforeEach } from "vitest";
import { renameManager } from "../../src/rename/manager.js";

const TEST_CHAT_ID = 123456;

describe("renameManager", () => {
  beforeEach(() => {
    renameManager.clear(TEST_CHAT_ID);
  });

  it("starts waiting for rename and tracks state", () => {
    renameManager.startWaiting(TEST_CHAT_ID, "session-123", "/path/to/project", "Old Title");

    expect(renameManager.isWaitingForName(TEST_CHAT_ID)).toBe(true);
    const info = renameManager.getSessionInfo(TEST_CHAT_ID);
    expect(info).toEqual({
      sessionId: "session-123",
      directory: "/path/to/project",
      currentTitle: "Old Title",
    });
  });

  it("tracks message ID for cleanup", () => {
    renameManager.startWaiting(TEST_CHAT_ID, "session-456", "/path", "Test");
    renameManager.setMessageId(TEST_CHAT_ID, 42);

    expect(renameManager.getMessageId(TEST_CHAT_ID)).toBe(42);
    expect(renameManager.isActiveMessage(TEST_CHAT_ID, 42)).toBe(true);
    expect(renameManager.isActiveMessage(TEST_CHAT_ID, 99)).toBe(false);
  });

  it("clears state completely", () => {
    renameManager.startWaiting(TEST_CHAT_ID, "session-789", "/path", "Title");
    renameManager.setMessageId(TEST_CHAT_ID, 100);

    renameManager.clear(TEST_CHAT_ID);

    expect(renameManager.isWaitingForName(TEST_CHAT_ID)).toBe(false);
    expect(renameManager.getSessionInfo(TEST_CHAT_ID)).toBeNull();
    expect(renameManager.getMessageId(TEST_CHAT_ID)).toBeNull();
  });

  it("returns null session info when not waiting", () => {
    expect(renameManager.isWaitingForName(TEST_CHAT_ID)).toBe(false);
    expect(renameManager.getSessionInfo(TEST_CHAT_ID)).toBeNull();
  });
});
