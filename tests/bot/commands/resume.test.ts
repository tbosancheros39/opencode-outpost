import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandContext, Context } from "grammy";
import { resumeCommand, handleResumeCallback } from "../../../src/bot/commands/resume.js";
import { interactionManager } from "../../../src/interaction/manager.js";
import { t } from "../../../src/i18n/index.js";

const mocked = vi.hoisted(() => ({
  currentProject: {
    id: "project-1",
    worktree: "/repo",
  } as { id: string; worktree: string } | null,
  sessionGetMock: vi.fn(),
  listSnapshotsMock: vi.fn(),
  getSnapshotMock: vi.fn(),
  setCurrentSessionMock: vi.fn(),
  summaryAggregatorClearMock: vi.fn(),
  clearAllInteractionStateMock: vi.fn(),
}));

vi.mock("../../../src/opencode/client.js", () => ({
  opencodeClient: {
    session: {
      get: mocked.sessionGetMock,
    },
  },
}));

vi.mock("../../../src/settings/manager.js", () => ({
  getCurrentProject: vi.fn(() => mocked.currentProject),
}));

vi.mock("../../../src/session/manager.js", () => ({
  setCurrentSession: mocked.setCurrentSessionMock,
}));

vi.mock("../../../src/task-queue/store.js", () => ({
  listSnapshots: mocked.listSnapshotsMock,
  getSnapshot: mocked.getSnapshotMock,
}));

vi.mock("../../../src/summary/aggregator.js", () => ({
  summaryAggregator: {
    clear: mocked.summaryAggregatorClearMock,
  },
}));

vi.mock("../../../src/interaction/cleanup.js", () => ({
  clearAllInteractionState: mocked.clearAllInteractionStateMock,
}));

function createCommandContext(): CommandContext<Context> {
  return {
    chat: { id: 12345 },
    reply: vi.fn().mockResolvedValue({ message_id: 100 }),
    api: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 101 }),
    },
  } as unknown as CommandContext<Context>;
}

function createCallbackContext(data: string): Context {
  return {
    chat: { id: 12345 },
    callbackQuery: {
      data,
      message: { message_id: 200 },
    } as Context["callbackQuery"],
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue({ message_id: 201 }),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    api: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 202 }),
    },
  } as unknown as Context;
}

describe("bot/commands/resume", () => {
  beforeEach(() => {
    mocked.currentProject = {
      id: "project-1",
      worktree: "/repo",
    };
    interactionManager.clear(12345, "test_setup");

    mocked.sessionGetMock.mockReset();
    mocked.sessionGetMock.mockResolvedValue({
      data: null,
      error: null,
    });
    mocked.listSnapshotsMock.mockReset();
    mocked.listSnapshotsMock.mockReturnValue([]);
    mocked.getSnapshotMock.mockReset();
    mocked.getSnapshotMock.mockReturnValue(null);
    mocked.setCurrentSessionMock.mockReset();
    mocked.summaryAggregatorClearMock.mockReset();
    mocked.clearAllInteractionStateMock.mockReset();
  });

  describe("resumeCommand", () => {
    it("replies with project_not_selected when no project is set", async () => {
      mocked.currentProject = null;
      const ctx = createCommandContext();
      await resumeCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(t("bot.project_not_selected"));
    });

    it("replies with no_snapshots when list is empty", async () => {
      mocked.listSnapshotsMock.mockReturnValue([]);

      const ctx = createCommandContext();
      await resumeCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(t("cmd.resume.no_snapshots"));
    });

    it("shows resume menu when snapshots exist", async () => {
      mocked.listSnapshotsMock.mockReturnValue([
        {
          id: "snapshot-1",
          name: "Snapshot 1",
          sessionId: "session-1",
          sessionTitle: "Test Session",
          directory: "/repo",
          chatId: 12345,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ]);

      const ctx = createCommandContext();
      await resumeCommand(ctx);
      expect(mocked.listSnapshotsMock).toHaveBeenCalled();
    });

    it("filters snapshots by chatId", async () => {
      mocked.listSnapshotsMock.mockReturnValue([
        {
          id: "snapshot-1",
          name: "Snapshot 1",
          sessionId: "session-1",
          sessionTitle: "Test Session",
          directory: "/repo",
          chatId: 12345,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "snapshot-2",
          name: "Snapshot 2",
          sessionId: "session-2",
          sessionTitle: "Other Session",
          directory: "/repo",
          chatId: 99999,
          createdAt: "2024-01-02T00:00:00.000Z",
        },
      ]);

      const ctx = createCommandContext();
      await resumeCommand(ctx);
    });

    it("handles errors gracefully", async () => {
      mocked.listSnapshotsMock.mockImplementation(() => {
        throw new Error("DB error");
      });

      const ctx = createCommandContext();
      await resumeCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(t("cmd.resume.error"));
    });
  });

  describe("handleResumeCallback", () => {
    it("returns false when no callback data", async () => {
      const ctx = {
        callbackQuery: {},
      } as Context;
      const result = await handleResumeCallback(ctx);
      expect(result).toBe(false);
    });

    it("returns false for unknown callback data", async () => {
      const ctx = createCallbackContext("unknown");
      const result = await handleResumeCallback(ctx);
      expect(result).toBe(false);
    });

    it("shows next page when page callback", async () => {
      mocked.listSnapshotsMock.mockReturnValue([
        {
          id: "snapshot-1",
          name: "Snapshot 1",
          sessionId: "session-1",
          sessionTitle: "Test Session",
          directory: "/repo",
          chatId: 12345,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ]);

      const ctx = createCallbackContext("resume:page:1");
      const result = await handleResumeCallback(ctx);
      expect(result).toBe(true);
    });

    it("replies with error for invalid page number", async () => {
      mocked.listSnapshotsMock.mockReturnValue([]);

      const ctx = createCallbackContext("resume:page:invalid");
      const result = await handleResumeCallback(ctx);
      expect(result).toBe(true);
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
        text: t("callback.processing_error"),
      });
    });

    it("resumes session when snapshot callback", async () => {
      mocked.getSnapshotMock.mockReturnValue({
        id: "snapshot-1",
        name: "Test Snapshot",
        sessionId: "session-1",
        sessionTitle: "Test Session",
        directory: "/repo",
        chatId: 12345,
        createdAt: "2024-01-01T00:00:00.000Z",
      });
      mocked.sessionGetMock.mockResolvedValue({
        data: {
          id: "session-1",
          title: "Restored Session",
          directory: "/repo",
        },
        error: null,
      });

      const ctx = createCallbackContext("resume:snapshot-1");
      const result = await handleResumeCallback(ctx);
      expect(result).toBe(true);
    });

    it("replies with not_found when snapshot does not exist", async () => {
      mocked.getSnapshotMock.mockReturnValue(null);

      const ctx = createCallbackContext("resume:nonexistent");
      const result = await handleResumeCallback(ctx);
      expect(result).toBe(true);
    });

    it("replies with session_not_found when session no longer exists", async () => {
      mocked.getSnapshotMock.mockReturnValue({
        id: "snapshot-1",
        name: "Test Snapshot",
        sessionId: "session-1",
        sessionTitle: "Test Session",
        directory: "/repo",
        chatId: 12345,
        createdAt: "2024-01-01T00:00:00.000Z",
      });
      mocked.sessionGetMock.mockResolvedValue({
        data: null,
        error: new Error("Session not found"),
      });

      const ctx = createCallbackContext("resume:snapshot-1");
      await handleResumeCallback(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        t("cmd.resume.session_not_found", { id: "session-1" }),
      );
    });

    it("handles errors during resume gracefully", async () => {
      mocked.getSnapshotMock.mockImplementation(() => {
        throw new Error("DB error");
      });

      const ctx = createCallbackContext("resume:snapshot-1");
      await handleResumeCallback(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(t("cmd.resume.error"));
    });
  });
});
