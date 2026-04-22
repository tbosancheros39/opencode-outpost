import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandContext, Context } from "grammy";
import { pinCommand, showPinMenu } from "../../../src/bot/commands/pin.js";
import { interactionManager } from "../../../src/interaction/manager.js";
import { t } from "../../../src/i18n/index.js";

const mocked = vi.hoisted(() => ({
  currentProject: {
    id: "project-1",
    worktree: "/repo",
  } as { id: string; worktree: string } | null,
  getPinnedFilesMock: vi.fn(() => []),
  setPinnedFilesMock: vi.fn(),
  recentFilesTrackerGetRecentFilesMock: vi.fn(() => []),
  recentFilesTrackerResetMock: vi.fn(),
  statMock: vi.fn(),
  replyWithInlineMenuMock: vi.fn(),
}));

vi.mock("../../../src/settings/manager.js", () => ({
  getCurrentProject: vi.fn(() => mocked.currentProject),
  getPinnedFiles: mocked.getPinnedFilesMock,
  setPinnedFiles: mocked.setPinnedFilesMock,
}));

vi.mock("../../../src/bot/recent-files-tracker.js", () => ({
  recentFilesTracker: {
    getRecentFiles: mocked.recentFilesTrackerGetRecentFilesMock,
    reset: mocked.recentFilesTrackerResetMock,
  },
}));

vi.mock("node:fs/promises", () => ({
  stat: mocked.statMock,
}));

vi.mock("../../../src/bot/handlers/inline-menu.js", () => ({
  replyWithInlineMenu: mocked.replyWithInlineMenuMock,
}));

vi.mock("../../../src/bot/utils/pin-helpers.js", () => ({
  buildPinKeyboard: vi.fn(() => ({ inline_keyboard: [] })),
  buildPinMenuText: vi.fn(() => "📌 Pin Files"),
  makeRelativePath: vi.fn((path: string) => path),
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

describe("bot/commands/pin", () => {
  beforeEach(() => {
    mocked.currentProject = {
      id: "project-1",
      worktree: "/repo",
    };
    interactionManager.clear(12345, "test_setup");

    mocked.getPinnedFilesMock.mockReset();
    mocked.getPinnedFilesMock.mockReturnValue([]);
    mocked.setPinnedFilesMock.mockReset();
    mocked.recentFilesTrackerGetRecentFilesMock.mockReset();
    mocked.recentFilesTrackerGetRecentFilesMock.mockReturnValue([]);
    mocked.replyWithInlineMenuMock.mockReset();
    mocked.replyWithInlineMenuMock.mockResolvedValue(100);
    mocked.statMock.mockReset();
  });

  describe("pinCommand", () => {
    it("shows pin menu when no args provided", async () => {
      const ctx = createCommandContext();
      await pinCommand(ctx);
      expect(mocked.replyWithInlineMenuMock).toHaveBeenCalled();
    });

    it("replies with project_not_selected when no project is set", async () => {
      mocked.currentProject = null;
      const ctx = createCommandContext("add /repo/test.js");
      await pinCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(t("bot.project_not_selected"));
    });

    it("replies with usage when add has no file path", async () => {
      const ctx = createCommandContext("add ");
      await pinCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(t("cmd.pin.usage_add"));
    });

    it("replies with usage when remove has no file path", async () => {
      const ctx = createCommandContext("remove ");
      await pinCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(t("cmd.pin.usage_remove"));
    });

    it("adds a pinned file successfully", async () => {
      mocked.statMock.mockResolvedValue({ isDirectory: () => false });

      const ctx = createCommandContext("add /repo/src/index.js");
      await pinCommand(ctx);

      expect(mocked.setPinnedFilesMock).toHaveBeenCalledWith(12345, ["/repo/src/index.js"]);
      expect(ctx.reply).toHaveBeenCalled();
    });

    it("adds a pinned file with custom name (no subcommand)", async () => {
      mocked.statMock.mockResolvedValue({ isDirectory: () => false });

      const ctx = createCommandContext("/repo/src/index.js");
      await pinCommand(ctx);

      expect(mocked.setPinnedFilesMock).toHaveBeenCalled();
    });

    it("replies with file_not_found when file does not exist", async () => {
      mocked.statMock.mockRejectedValue(new Error("ENOENT"));

      const ctx = createCommandContext("add /repo/nonexistent.js");
      await pinCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        t("cmd.pin.file_not_found", { path: "/repo/nonexistent.js" }),
      );
    });

    it("replies with error_is_directory when path is a directory", async () => {
      mocked.statMock.mockResolvedValue({ isDirectory: () => true });

      const ctx = createCommandContext("add /repo/src");
      await pinCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        t("cmd.pin.error_is_directory", { path: "/repo/src" }),
      );
    });

    it("replies with already_pinned when file is already pinned", async () => {
      mocked.getPinnedFilesMock.mockReturnValue(["/repo/src/index.js"]);
      mocked.statMock.mockResolvedValue({ isDirectory: () => false });

      const ctx = createCommandContext("add /repo/src/index.js");
      await pinCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        t("cmd.pin.already_pinned", { path: "/repo/src/index.js" }),
      );
    });

    it("replies with limit_reached when max pinned files reached", async () => {
      mocked.getPinnedFilesMock.mockReturnValue([
        "/repo/file1.js",
        "/repo/file2.js",
        "/repo/file3.js",
        "/repo/file4.js",
        "/repo/file5.js",
        "/repo/file6.js",
        "/repo/file7.js",
        "/repo/file8.js",
        "/repo/file9.js",
        "/repo/file10.js",
      ]);
      mocked.statMock.mockResolvedValue({ isDirectory: () => false });

      const ctx = createCommandContext("add /repo/newfile.js");
      await pinCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        t("cmd.pin.limit_reached", { limit: "10" }),
      );
    });

    it("removes a pinned file by exact path", async () => {
      mocked.getPinnedFilesMock.mockReturnValue(["/repo/src/index.js"]);

      const ctx = createCommandContext("remove /repo/src/index.js");
      await pinCommand(ctx);

      expect(mocked.setPinnedFilesMock).toHaveBeenCalledWith(12345, []);
      expect(ctx.reply).toHaveBeenCalled();
    });

    it("replies with not_found when removing non-existent file", async () => {
      mocked.getPinnedFilesMock.mockReturnValue([]);

      const ctx = createCommandContext("remove /repo/nonexistent.js");
      await pinCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        t("cmd.pin.not_found", { path: "/repo/nonexistent.js" }),
      );
    });

    it("clears all pinned files", async () => {
      mocked.getPinnedFilesMock.mockReturnValue(["/repo/file1.js", "/repo/file2.js"]);

      const ctx = createCommandContext("clear");
      await pinCommand(ctx);

      expect(mocked.setPinnedFilesMock).toHaveBeenCalledWith(12345, []);
      expect(ctx.reply).toHaveBeenCalledWith(t("cmd.pin.cleared"));
    });

    it("lists pinned files", async () => {
      mocked.getPinnedFilesMock.mockReturnValue(["/repo/src/index.js", "/repo/src/app.js"]);

      const ctx = createCommandContext("list");
      await pinCommand(ctx);

      expect(ctx.reply).toHaveBeenCalled();
    });

    it("replies with empty when listing no pinned files", async () => {
      mocked.getPinnedFilesMock.mockReturnValue([]);

      const ctx = createCommandContext("list");
      await pinCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(t("cmd.pin.empty"));
    });
  });

  describe("showPinMenu", () => {
    it("shows pin menu with empty state", async () => {
      const ctx = {
        chat: { id: 12345 },
        reply: vi.fn().mockResolvedValue({ message_id: 100 }),
      } as unknown as Context;

      await showPinMenu(ctx, 12345);

      expect(mocked.replyWithInlineMenuMock).toHaveBeenCalledWith(ctx, {
        menuKind: "pin",
        text: expect.any(String),
        keyboard: expect.any(Object),
      });
    });

    it("shows pin menu with recent and pinned files", async () => {
      mocked.recentFilesTrackerGetRecentFilesMock.mockReturnValue([
        "/repo/src/index.js",
        "/repo/src/app.js",
      ]);
      mocked.getPinnedFilesMock.mockReturnValue(["/repo/config.js"]);

      const ctx = {
        chat: { id: 12345 },
        reply: vi.fn().mockResolvedValue({ message_id: 100 }),
      } as unknown as Context;

      await showPinMenu(ctx, 12345);

      expect(mocked.replyWithInlineMenuMock).toHaveBeenCalled();
    });
  });
});
