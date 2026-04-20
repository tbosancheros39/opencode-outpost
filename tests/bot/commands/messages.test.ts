import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import { messagesCommand, handleMessagesCallback } from "../../../src/bot/commands/messages.js";
import { interactionManager } from "../../../src/interaction/manager.js";

const mocked = vi.hoisted(() => ({
  currentProject: {
    id: "project-1",
    worktree: "D:\\Projects\\Repo",
  } as { id: string; worktree: string } | null,
  currentSession: {
    id: "session-1",
    title: "Test Session",
    directory: "D:\\Projects\\Repo",
  } as { id: string; title: string; directory: string } | null,
  sessionMessagesMock: vi.fn(),
  sessionForkMock: vi.fn(),
  sessionRevertMock: vi.fn(),
}));

vi.mock("../../../src/settings/manager.js", () => ({
  getCurrentProject: vi.fn(() => mocked.currentProject),
}));

vi.mock("../../../src/session/manager.js", () => ({
  getCurrentSession: vi.fn(() => mocked.currentSession),
}));

vi.mock("../../../src/opencode/client.js", () => ({
  opencodeClient: {
    session: {
      messages: mocked.sessionMessagesMock,
      fork: mocked.sessionForkMock,
      revert: mocked.sessionRevertMock,
    },
  },
}));

function createCommandContext(): Context {
  return {
    chat: { id: 777 },
    reply: vi.fn().mockResolvedValue({ message_id: 123 }),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
    api: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 900 }),
      deleteMessage: vi.fn().mockResolvedValue(true),
    },
  } as unknown as Context;
}

function createCallbackContext(data: string, messageId: number): Context {
  return {
    chat: { id: 777 },
    callbackQuery: {
      data,
      message: {
        message_id: messageId,
      },
    } as Context["callbackQuery"],
    reply: vi.fn().mockResolvedValue({ message_id: 901 }),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
    api: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 902 }),
      deleteMessage: vi.fn().mockResolvedValue(true),
    },
  } as unknown as Context;
}

describe("bot/commands/messages", () => {
  beforeEach(() => {
    interactionManager.clear(777);

    mocked.currentProject = {
      id: "project-1",
      worktree: "D:\\Projects\\Repo",
    };
    mocked.currentSession = {
      id: "session-1",
      title: "Test Session",
      directory: "D:\\Projects\\Repo",
    };

    mocked.sessionMessagesMock.mockReset();
    mocked.sessionForkMock.mockReset();
    mocked.sessionRevertMock.mockReset();
  });

  it("shows no session message when session is missing", async () => {
    mocked.currentSession = null;

    const ctx = createCommandContext();
    await messagesCommand(ctx as never);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("No active session"));
  });

  it("shows no project message when project is missing", async () => {
    mocked.currentProject = null;

    const ctx = createCommandContext();
    await messagesCommand(ctx as never);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("No active project"));
  });

  it("shows empty messages when no messages in session", async () => {
    mocked.sessionMessagesMock.mockResolvedValue({
      data: [],
      error: null,
    });

    const ctx = createCommandContext();
    await messagesCommand(ctx as never);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("No messages"));
  });

  it("displays messages with pagination", async () => {
    const now = Date.now();
    mocked.sessionMessagesMock.mockResolvedValue({
      data: [
        {
          info: {
            id: "msg-1",
            role: "user",
            time: { created: now - 2000 },
          },
          parts: [{ type: "text", text: "Hello" }],
        },
        {
          info: {
            id: "msg-2",
            role: "assistant",
            time: { created: now - 1000 },
          },
          parts: [{ type: "text", text: "Hi there!" }],
        },
      ],
      error: null,
    });

    const ctx = createCommandContext();
    await messagesCommand(ctx as never);

    expect(mocked.sessionMessagesMock).toHaveBeenCalledWith({
      sessionID: "session-1",
      directory: "D:\\Projects\\Repo",
      limit: 1000,
    });

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const replyCall = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(replyCall[0]).toContain("Hello");
    expect(replyCall[0]).toContain("Hi there!");
  });

  it("handles cancel callback", async () => {
    interactionManager.start(777, {
      kind: "custom",
      expectedInput: "callback",
      metadata: {
        flow: "messages",
        stage: "list",
        messageId: 123,
        sessionId: "session-1",
        directory: "D:\\Projects\\Repo",
        messages: [],
        page: 0,
        totalMessages: 0,
      },
    });

    const ctx = createCallbackContext("messages:cancel", 123);
    const handled = await handleMessagesCallback(ctx);

    expect(handled).toBe(true);
    expect(interactionManager.getSnapshot(777)).toBeNull();
  });

  it("handles fork callback", async () => {
    interactionManager.start(777, {
      kind: "custom",
      expectedInput: "callback",
      metadata: {
        flow: "messages",
        stage: "list",
        messageId: 123,
        sessionId: "session-1",
        directory: "D:\\Projects\\Repo",
        messages: [],
        page: 0,
        totalMessages: 0,
      },
    });

    mocked.sessionForkMock.mockResolvedValue({
      data: { id: "new-session-id" },
      error: null,
    });

    const ctx = createCallbackContext("messages:fork:msg-1", 123);
    const handled = await handleMessagesCallback(ctx);

    expect(handled).toBe(true);
    expect(mocked.sessionForkMock).toHaveBeenCalledWith({
      sessionID: "session-1",
      directory: "D:\\Projects\\Repo",
      messageID: "msg-1",
    });
  });

  it("handles revert callback", async () => {
    interactionManager.start(777, {
      kind: "custom",
      expectedInput: "callback",
      metadata: {
        flow: "messages",
        stage: "list",
        messageId: 123,
        sessionId: "session-1",
        directory: "D:\\Projects\\Repo",
        messages: [],
        page: 0,
        totalMessages: 0,
      },
    });

    mocked.sessionRevertMock.mockResolvedValue({
      data: {},
      error: null,
    });

    const ctx = createCallbackContext("messages:revert:msg-1", 123);
    const handled = await handleMessagesCallback(ctx);

    expect(handled).toBe(true);
    expect(mocked.sessionRevertMock).toHaveBeenCalledWith({
      sessionID: "session-1",
      directory: "D:\\Projects\\Repo",
      messageID: "msg-1",
    });
  });

  it("returns false for non-messages callbacks", async () => {
    const ctx = createCallbackContext("session:page:0", 123);
    const handled = await handleMessagesCallback(ctx);
    expect(handled).toBe(false);
  });
});
