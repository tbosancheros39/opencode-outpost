import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import { mcpsCommand, handleMcpsCallback } from "../../../src/bot/commands/mcps.js";
import { interactionManager } from "../../../src/interaction/manager.js";

const mocked = vi.hoisted(() => ({
  currentProject: {
    id: "project-1",
    worktree: "D:\\Projects\\Repo",
  } as { id: string; worktree: string } | null,
  mcpStatusMock: vi.fn(),
  mcpConnectMock: vi.fn(),
  mcpDisconnectMock: vi.fn(),
}));

vi.mock("../../../src/settings/manager.js", () => ({
  getCurrentProject: vi.fn(() => mocked.currentProject),
}));

vi.mock("../../../src/opencode/client.js", () => ({
  opencodeClient: {
    mcp: {
      status: mocked.mcpStatusMock,
      connect: mocked.mcpConnectMock,
      disconnect: mocked.mcpDisconnectMock,
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

describe("bot/commands/mcps", () => {
  beforeEach(() => {
    interactionManager.clear(777);

    mocked.currentProject = {
      id: "project-1",
      worktree: "D:\\Projects\\Repo",
    };

    mocked.mcpStatusMock.mockReset();
    mocked.mcpConnectMock.mockReset();
    mocked.mcpDisconnectMock.mockReset();
  });

  it("shows no project message when project is missing", async () => {
    mocked.currentProject = null;

    const ctx = createCommandContext();
    await mcpsCommand(ctx as never);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("No active project"));
  });

  it("shows empty MCP servers when no servers available", async () => {
    mocked.mcpStatusMock.mockResolvedValue({
      data: {},
      error: null,
    });

    const ctx = createCommandContext();
    await mcpsCommand(ctx as never);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("No MCP servers configured"));
  });

  it("displays MCP servers with their status", async () => {
    mocked.mcpStatusMock.mockResolvedValue({
      data: {
        filesystem: { status: "connected" },
        github: { status: "disabled" },
        slack: { status: "failed", error: "Connection timeout" },
      },
      error: null,
    });

    const ctx = createCommandContext();
    await mcpsCommand(ctx as never);

    expect(mocked.mcpStatusMock).toHaveBeenCalledWith({
      directory: "D:\\Projects\\Repo",
    });

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const replyCall = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(replyCall[0]).toContain("filesystem");
    expect(replyCall[0]).toContain("github");
    expect(replyCall[0]).toContain("slack");
    expect(replyCall[0]).toContain("Connected");
    expect(replyCall[0]).toContain("Disabled");
    expect(replyCall[0]).toContain("Failed");
  });

  it("handles cancel callback", async () => {
    interactionManager.start(777, {
      kind: "custom",
      expectedInput: "callback",
      metadata: {
        flow: "mcps",
        stage: "list",
        messageId: 123,
        directory: "D:\\Projects\\Repo",
        servers: [],
      },
    });

    const ctx = createCallbackContext("mcps:cancel", 123);
    const handled = await handleMcpsCallback(ctx);

    expect(handled).toBe(true);
    expect(interactionManager.getSnapshot(777)).toBeNull();
  });

  it("handles disconnect callback", async () => {
    mocked.mcpStatusMock.mockResolvedValue({
      data: {
        github: { status: "connected" },
      },
      error: null,
    });

    interactionManager.start(777, {
      kind: "custom",
      expectedInput: "callback",
      metadata: {
        flow: "mcps",
        stage: "list",
        messageId: 123,
        directory: "D:\\Projects\\Repo",
        servers: [{ name: "github", status: "connected" }],
      },
    });

    mocked.mcpDisconnectMock.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const ctx = createCallbackContext("mcps:disconnect:github", 123);
    const handled = await handleMcpsCallback(ctx);

    expect(handled).toBe(true);
    expect(mocked.mcpDisconnectMock).toHaveBeenCalledWith({
      name: "github",
      directory: "D:\\Projects\\Repo",
    });
  });

  it("handles connect callback", async () => {
    mocked.mcpStatusMock.mockResolvedValue({
      data: {
        github: { status: "disabled" },
      },
      error: null,
    });

    interactionManager.start(777, {
      kind: "custom",
      expectedInput: "callback",
      metadata: {
        flow: "mcps",
        stage: "list",
        messageId: 123,
        directory: "D:\\Projects\\Repo",
        servers: [{ name: "github", status: "disabled" }],
      },
    });

    mocked.mcpConnectMock.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const ctx = createCallbackContext("mcps:connect:github", 123);
    const handled = await handleMcpsCallback(ctx);

    expect(handled).toBe(true);
    expect(mocked.mcpConnectMock).toHaveBeenCalledWith({
      name: "github",
      directory: "D:\\Projects\\Repo",
    });
  });

  it("returns false for non-mcps callbacks", async () => {
    const ctx = createCallbackContext("session:page:0", 123);
    const handled = await handleMcpsCallback(ctx);
    expect(handled).toBe(false);
  });

  it("shows inactive callback for wrong message ID", async () => {
    interactionManager.start(777, {
      kind: "custom",
      expectedInput: "callback",
      metadata: {
        flow: "mcps",
        stage: "list",
        messageId: 123,
        directory: "D:\\Projects\\Repo",
        servers: [],
      },
    });

    const ctx = createCallbackContext("mcps:cancel", 999);
    const handled = await handleMcpsCallback(ctx);

    expect(handled).toBe(true);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("inactive") }),
    );
  });
});
