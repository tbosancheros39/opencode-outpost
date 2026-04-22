import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandContext, Context } from "grammy";
import { snapshotCommand, handleSnapshotCallback } from "../../../src/bot/commands/snapshot.js";
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
  createSnapshotMock: vi.fn(),
  listSnapshotsMock: vi.fn(),
  deleteSnapshotMock: vi.fn(),
  getSnapshotMock: vi.fn(),
}));

vi.mock("../../../src/settings/manager.js", () => ({
  getCurrentProject: vi.fn(() => mocked.currentProject),
  getCurrentSession: vi.fn(() => mocked.currentSession),
}));

vi.mock("../../../src/task-queue/store.js", () => ({
  createSnapshot: mocked.createSnapshotMock,
  listSnapshots: mocked.listSnapshotsMock,
  deleteSnapshot: mocked.deleteSnapshotMock,
  getSnapshot: mocked.getSnapshotMock,
}));

function createCommandContext(args = ""): CommandContext<Context> {
  return {
    chat: { id: 12345 },
    match: { toString: () => args },
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

describe("bot/commands/snapshot", () => {
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
    mocked.createSnapshotMock.mockReset();
    mocked.createSnapshotMock.mockReturnValue({
      id: "snapshot-1",
      name: "Test Snapshot",
      chatId: 12345,
      sessionId: "session-1",
      sessionTitle: "Test Session",
      directory: "/repo",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    mocked.listSnapshotsMock.mockReset();
    mocked.listSnapshotsMock.mockReturnValue([]);
    mocked.deleteSnapshotMock.mockReset();
    mocked.deleteSnapshotMock.mockReturnValue(true);
    mocked.getSnapshotMock.mockReset();
    mocked.getSnapshotMock.mockReturnValue(null);
  });

  describe("snapshotCommand", () => {
    it("replies with project_not_selected when no project is set", async () => {
      mocked.currentProject = null;
      const ctx = createCommandContext();
      await snapshotCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(t("bot.project_not_selected"));
    });

    it("replies with no_session when no session is active", async () => {
      mocked.currentSession = null;
      const ctx = createCommandContext();
      await snapshotCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(t("cmd.snapshot.no_session"));
    });

    it("saves a snapshot with auto-generated name", async () => {
      const ctx = createCommandContext();
      await snapshotCommand(ctx);
      expect(mocked.createSnapshotMock).toHaveBeenCalledWith({
        chatId: 12345,
        sessionId: "session-1",
        sessionTitle: "Test Session",
        directory: "/repo",
        name: expect.any(String),
      });
    });

    it("saves a snapshot with custom name", async () => {
      const ctx = createCommandContext("My Custom Snapshot");
      await snapshotCommand(ctx);
      expect(mocked.createSnapshotMock).toHaveBeenCalledWith({
        chatId: 12345,
        sessionId: "session-1",
        sessionTitle: "Test Session",
        directory: "/repo",
        name: "My Custom Snapshot",
      });
    });

    it("saves snapshot when using save subcommand", async () => {
      const ctx = createCommandContext("save");
      await snapshotCommand(ctx);
      expect(mocked.createSnapshotMock).toHaveBeenCalled();
    });

    it("lists snapshots", async () => {
      mocked.listSnapshotsMock.mockReturnValue([
        {
          id: "snapshot-1",
          name: "Snapshot 1",
          chatId: 12345,
          sessionId: "session-1",
          sessionTitle: "Test Session",
          directory: "/repo",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ]);

      const ctx = createCommandContext("list");
      await snapshotCommand(ctx);
      expect(mocked.listSnapshotsMock).toHaveBeenCalledWith("session-1");
    });

    it("shows empty list message when no snapshots", async () => {
      mocked.listSnapshotsMock.mockReturnValue([]);

      const ctx = createCommandContext("list");
      await snapshotCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(t("cmd.snapshot.empty"));
    });

    it("loads a snapshot by id", async () => {
      mocked.getSnapshotMock.mockReturnValue({
        id: "snapshot-1",
        name: "Test Snapshot",
        chatId: 12345,
        sessionId: "session-1",
        sessionTitle: "Test Session",
        directory: "/repo",
        createdAt: "2024-01-01T00:00:00.000Z",
      });

      const ctx = createCommandContext("load snapshot-1");
      await snapshotCommand(ctx);
      expect(mocked.getSnapshotMock).toHaveBeenCalledWith("snapshot-1");
    });

    it("replies with usage when load subcommand has no id", async () => {
      const ctx = createCommandContext("load ");
      await snapshotCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(t("cmd.snapshot.usage_load"));
    });

    it("deletes a snapshot by id", async () => {
      mocked.deleteSnapshotMock.mockReturnValue(true);

      const ctx = createCommandContext("delete snapshot-1");
      await snapshotCommand(ctx);
      expect(mocked.deleteSnapshotMock).toHaveBeenCalledWith("snapshot-1");
    });

    it("replies with usage when delete subcommand has no id", async () => {
      const ctx = createCommandContext("delete ");
      await snapshotCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(t("cmd.snapshot.usage_delete"));
    });

    it("replies with not_found when deleting non-existent snapshot", async () => {
      mocked.deleteSnapshotMock.mockReturnValue(false);

      const ctx = createCommandContext("delete nonexistent");
      await snapshotCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        t("cmd.snapshot.not_found", { id: "nonexistent" }),
      );
    });
  });

  describe("handleSnapshotCallback", () => {
    it("returns false when no callback data", async () => {
      const ctx = {
        callbackQuery: {},
      } as Context;
      const result = await handleSnapshotCallback(ctx);
      expect(result).toBe(false);
    });

    it("returns false for unknown callback data", async () => {
      const ctx = createCallbackContext("unknown");
      const result = await handleSnapshotCallback(ctx);
      expect(result).toBe(false);
    });

    it("shows next page of snapshots", async () => {
      mocked.listSnapshotsMock.mockReturnValue([
        {
          id: "snapshot-1",
          name: "Snapshot 1",
          chatId: 12345,
          sessionId: "session-1",
          sessionTitle: "Test Session",
          directory: "/repo",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ]);

      const ctx = createCallbackContext("snapshot:page:1");
      const result = await handleSnapshotCallback(ctx);
      expect(result).toBe(true);
    });

    it("loads snapshot when callback data starts with prefix", async () => {
      mocked.getSnapshotMock.mockReturnValue({
        id: "snapshot-1",
        name: "Test Snapshot",
        chatId: 12345,
        sessionId: "session-1",
        sessionTitle: "Test Session",
        directory: "/repo",
        createdAt: "2024-01-01T00:00:00.000Z",
      });

      const ctx = createCallbackContext("snapshot:snapshot-1");
      const result = await handleSnapshotCallback(ctx);
      expect(result).toBe(true);
    });
  });
});
