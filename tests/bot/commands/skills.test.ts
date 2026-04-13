import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import { skillsCommand, handleSkillsCallback } from "../../../src/bot/commands/skills.js";
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
  commandListMock: vi.fn(),
}));

vi.mock("../../../src/settings/manager.js", () => ({
  getCurrentProject: vi.fn(() => mocked.currentProject),
}));

vi.mock("../../../src/session/manager.js", () => ({
  getCurrentSession: vi.fn(() => mocked.currentSession),
}));

vi.mock("../../../src/opencode/client.js", () => ({
  opencodeClient: {
    command: {
      list: mocked.commandListMock,
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

describe("bot/commands/skills", () => {
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

    mocked.commandListMock.mockReset();
  });

  it("shows no project message when project is missing", async () => {
    mocked.currentProject = null;

    const ctx = createCommandContext();
    await skillsCommand(ctx as never);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("No active project"));
  });

  it("shows empty skills when no skills available", async () => {
    mocked.commandListMock.mockResolvedValue({
      data: [],
      error: null,
    });

    const ctx = createCommandContext();
    await skillsCommand(ctx as never);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("No skills available"));
  });

  it("displays skills filtered from command list", async () => {
    mocked.commandListMock.mockResolvedValue({
      data: [
        { name: "code-review", description: "Review code changes", source: "skill" },
        { name: "init", description: "Initialize project", source: "command" },
        { name: "debug-helper", description: "Help with debugging", source: "skill" },
      ],
      error: null,
    });

    const ctx = createCommandContext();
    await skillsCommand(ctx as never);

    expect(mocked.commandListMock).toHaveBeenCalledWith({
      directory: "D:\\Projects\\Repo",
    });

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const replyCall = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(replyCall[0]).toContain("code-review");
    expect(replyCall[0]).toContain("debug-helper");
    expect(replyCall[0]).not.toContain("init");
  });

  it("handles cancel callback", async () => {
    interactionManager.start(777, {
      kind: "custom",
      expectedInput: "callback",
      metadata: {
        flow: "skills",
        stage: "list",
        messageId: 123,
        directory: "D:\\Projects\\Repo",
        skills: [],
        page: 0,
        totalSkills: 0,
      },
    });

    const ctx = createCallbackContext("skills:cancel", 123);
    const handled = await handleSkillsCallback(ctx);

    expect(handled).toBe(true);
    expect(interactionManager.getSnapshot(777)).toBeNull();
  });

  it("handles skill toggle callback", async () => {
    interactionManager.start(777, {
      kind: "custom",
      expectedInput: "callback",
      metadata: {
        flow: "skills",
        stage: "list",
        messageId: 123,
        directory: "D:\\Projects\\Repo",
        skills: [{ name: "code-review", description: "Review code" }],
        page: 0,
        totalSkills: 1,
      },
    });

    const ctx = createCallbackContext("skills:toggle:code-review", 123);
    const handled = await handleSkillsCallback(ctx);

    expect(handled).toBe(true);
  });

  it("returns false for non-skills callbacks", async () => {
    const ctx = createCallbackContext("session:page:0", 123);
    const handled = await handleSkillsCallback(ctx);
    expect(handled).toBe(false);
  });
});
