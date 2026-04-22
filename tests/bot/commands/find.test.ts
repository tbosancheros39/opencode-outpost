import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandContext, Context } from "grammy";
import { findCommand } from "../../../src/bot/commands/find.js";
import { t } from "../../../src/i18n/index.js";

const mocked = vi.hoisted(() => ({
  currentProject: {
    id: "project-1",
    worktree: "/repo",
  } as { id: string; worktree: string } | null,
  currentSession: {
    id: "session-1",
    title: "Test Session",
    directory: "/repo",
  } as { id: string; title: string; directory: string } | null,
  sessionMessagesMock: vi.fn(),
}));

vi.mock("../../../src/opencode/client.js", () => ({
  opencodeClient: {
    session: {
      messages: mocked.sessionMessagesMock,
    },
  },
}));

vi.mock("../../../src/settings/manager.js", () => ({
  getCurrentProject: vi.fn(() => mocked.currentProject),
  getCurrentSession: vi.fn(() => mocked.currentSession),
}));

function createCommandContext(query = ""): CommandContext<Context> {
  return {
    chat: { id: 12345 },
    match: { toString: () => query },
    reply: vi.fn().mockResolvedValue({ message_id: 100 }),
    api: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 101 }),
    },
  } as unknown as CommandContext<Context>;
}

describe("bot/commands/find", () => {
  beforeEach(() => {
    mocked.currentProject = {
      id: "project-1",
      worktree: "/repo",
    };
    mocked.currentSession = {
      id: "session-1",
      title: "Test Session",
      directory: "/repo",
    };
    mocked.sessionMessagesMock.mockReset();
    mocked.sessionMessagesMock.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it("replies with usage when no query provided", async () => {
    const ctx = createCommandContext("");
    await findCommand(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(t("cmd.find.usage"));
  });

  it("replies with project_not_selected when no project is set", async () => {
    mocked.currentProject = null;
    const ctx = createCommandContext("test query");
    await findCommand(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(t("bot.project_not_selected"));
  });

  it("replies with no_session when no session is active", async () => {
    mocked.currentSession = null;
    const ctx = createCommandContext("test query");
    await findCommand(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(t("cmd.find.no_session"));
  });

  it("replies with error when query is too long", async () => {
    const longQuery = "a".repeat(501);
    const ctx = createCommandContext(longQuery);
    await findCommand(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(t("cmd.find.error_query_too_long"));
  });

  it("replies with no_messages when session has no messages", async () => {
    mocked.sessionMessagesMock.mockResolvedValue({
      data: [],
      error: null,
    });

    const ctx = createCommandContext("test query");
    await findCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(t("cmd.find.no_messages"));
  });

  it("searches and returns results", async () => {
    mocked.sessionMessagesMock.mockResolvedValue({
      data: [
        {
          info: { id: "msg-1", role: "user", time: { created: 1700000000000 } },
          parts: [{ type: "text", text: "How do I implement authentication?" }],
        },
        {
          info: { id: "msg-2", role: "assistant", time: { created: 1700000001000 } },
          parts: [{ type: "text", text: "You can use JWT for authentication." }],
        },
      ],
      error: null,
    });

    const ctx = createCommandContext("authentication");
    await findCommand(ctx);

    expect(mocked.sessionMessagesMock).toHaveBeenCalledWith({
      sessionID: "session-1",
      directory: "/repo",
    });
  });

  it("replies with no_results when search yields no matches", async () => {
    mocked.sessionMessagesMock.mockResolvedValue({
      data: [
        {
          info: { id: "msg-1", role: "user", time: { created: 1700000000000 } },
          parts: [{ type: "text", text: "Hello world" }],
        },
      ],
      error: null,
    });

    const ctx = createCommandContext("xyznonexistent");
    await findCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(t("cmd.find.no_results"));
  });

  it("replies with no_messages when session returns null data with error", async () => {
    mocked.sessionMessagesMock.mockResolvedValue({
      data: null,
      error: new Error("API error"),
    });

    const ctx = createCommandContext("test query");
    await findCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(t("cmd.find.no_messages"));
  });
});
