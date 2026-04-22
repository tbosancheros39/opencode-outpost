import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandContext, Context } from "grammy";
import { digestCommand } from "../../../src/bot/commands/digest.js";
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

function createCommandContext(): CommandContext<Context> {
  return {
    chat: { id: 12345 },
    match: { toString: () => "" },
    reply: vi.fn().mockResolvedValue({ message_id: 100 }),
    api: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 101 }),
    },
  } as unknown as CommandContext<Context>;
}

describe("bot/commands/digest", () => {
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

  it("replies with project_not_selected when no project is set", async () => {
    mocked.currentProject = null;
    const ctx = createCommandContext();
    await digestCommand(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(t("bot.project_not_selected"));
  });

  it("replies with no_session when no session is active", async () => {
    mocked.currentSession = null;
    const ctx = createCommandContext();
    await digestCommand(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(t("cmd.digest.no_session"));
  });

  it("generates digest with messages", async () => {
    mocked.sessionMessagesMock.mockResolvedValue({
      data: [
        {
          info: { id: "msg-1", role: "user", time: { created: 1700000000000 } },
          parts: [{ type: "text", text: "Hello" }],
        },
        {
          info: { id: "msg-2", role: "assistant", time: { created: 1700000001000 } },
          parts: [{ type: "text", text: "Hi there!" }],
        },
      ],
      error: null,
    });

    const ctx = createCommandContext();
    await digestCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(t("cmd.digest.generating"));
  });

  it("replies with empty digest when no messages", async () => {
    mocked.sessionMessagesMock.mockResolvedValue({
      data: [],
      error: null,
    });

    const ctx = createCommandContext();
    await digestCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(t("cmd.digest.empty"));
  });

  it("replies with empty digest when messages returns null data with error", async () => {
    mocked.sessionMessagesMock.mockResolvedValue({
      data: null,
      error: new Error("API error"),
    });

    const ctx = createCommandContext();
    await digestCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(t("cmd.digest.empty"));
  });

  it("includes focus parameter in digest", async () => {
    mocked.sessionMessagesMock.mockResolvedValue({
      data: [
        {
          info: { id: "msg-1", role: "user", time: { created: 1700000000000 } },
          parts: [{ type: "text", text: "About authentication" }],
        },
      ],
      error: null,
    });

    const ctx = createCommandContext();
    ctx.match = { toString: () => "auth" };

    await digestCommand(ctx);
  });
});
